use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use serde::Serialize;

use crate::ffmpeg::{builder, finder, progress as progress_parser};
use crate::models::ConversionSettings;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// Holds live ffmpeg child processes keyed by job ID so they can be cancelled.
#[derive(Clone, Default)]
pub struct ActiveJobs(pub Arc<Mutex<HashMap<String, Child>>>);

/// Buffer of job-started payloads that were emitted before the frontend
/// attached its listeners (e.g. on cold-launch dock drop).  The frontend
/// drains this on mount to catch up.
#[derive(Clone, Default)]
pub struct PendingJobStarts(pub Arc<Mutex<Vec<JobStartedEvent>>>);

// ---------------------------------------------------------------------------
// Event payloads (Rust → Frontend)
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    job_id: String,
    out_time_ms: u64,
    speed: f64,
    done: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompleteEvent {
    job_id: String,
    output_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorEvent {
    job_id: String,
    error: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStartedEvent {
    pub job_id: String,
    pub input_path: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

pub(crate) fn make_output_path(input: &str) -> Result<String, String> {
    use std::path::Path;
    let p = Path::new(input);
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| format!("Invalid input path: {input}"))?;
    let dir = p.parent().unwrap_or(Path::new("."));
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
    let output_stem = if ext.to_lowercase() == "mp4" {
        format!("{stem}-converted")
    } else {
        stem.to_string()
    };
    Ok(dir
        .join(format!("{output_stem}.mp4"))
        .to_string_lossy()
        .to_string())
}

/// Synchronous helper so the async `dispatch_conversion` doesn't hold a
/// MutexGuard across `.await` points.  Pushes a `job-started` payload into
/// the pending buffer (bounded), for the frontend to drain on mount.
fn push_pending_job_start(app: &AppHandle, started: JobStartedEvent) {
    let pending = app.state::<PendingJobStarts>();
    let Ok(mut buf) = pending.0.lock() else { return };
    if buf.len() >= 64 {
        buf.remove(0);
    }
    buf.push(started);
}

fn new_job_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let micros = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    format!("{micros:x}")
}

// ---------------------------------------------------------------------------
// Core dispatch logic (shared by command and RunEvent::Opened handler)
// ---------------------------------------------------------------------------

/// Start a conversion job for `input_path` using `settings`.  Returns the job ID.
/// This is the single place that spawns ffmpeg — both the Tauri command and the
/// dock-drop handler call through here.
pub async fn dispatch_conversion(
    input_path: String,
    settings: ConversionSettings,
    app: AppHandle,
) -> Result<String, String> {
    let ffmpeg_path = finder::find_ffmpeg(settings.ffmpeg_path.as_deref())
        .ok_or_else(|| "ffmpeg not found. Install via: brew install ffmpeg".to_string())?;

    let output_path = make_output_path(&input_path)?;
    let args = builder::build_args(&input_path, &output_path, &settings);

    let mut child = tokio::process::Command::new(&ffmpeg_path)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture ffmpeg stdout".to_string())?;

    let job_id = new_job_id();

    // Store child handle so cancel_conversion can kill it.
    {
        let jobs = app.state::<ActiveJobs>();
        let mut map = jobs.0.lock().map_err(|_| "job store lock poisoned".to_string())?;
        map.insert(job_id.clone(), child);
    }

    // Emit job-started so the frontend can add a queue entry immediately,
    // AND push a copy into the pending buffer so a freshly-mounted frontend
    // (cold-launch dock drop) can catch up via `take_pending_job_starts`.
    let started = JobStartedEvent {
        job_id: job_id.clone(),
        input_path: input_path.clone(),
    };
    let _ = app.emit("job-started", &started);
    push_pending_job_start(&app, started);

    // Background task: read progress lines, then wait for the process to exit.
    let job_id_bg = job_id.clone();
    let app_bg = app.clone();
    let output_path_bg = output_path.clone();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        let mut out_time_ms: u64 = 0;
        let mut speed: f64 = 0.0;

        while let Ok(Some(line)) = lines.next_line().await {
            if let Some((key, val)) = progress_parser::parse_progress_line(&line) {
                match key {
                    "out_time_ms" => {
                        // ffmpeg names this field _ms but the unit is microseconds
                        if let Some(us) = progress_parser::parse_out_time_ms(val) {
                            out_time_ms = us / 1000;
                        }
                    }
                    "speed" => {
                        if let Some(s) = progress_parser::parse_speed(val) {
                            speed = s;
                        }
                    }
                    "progress" => {
                        let done = val == "end";
                        let _ = app_bg.emit(
                            "conversion-progress",
                            ProgressEvent {
                                job_id: job_id_bg.clone(),
                                out_time_ms,
                                speed,
                                done,
                            },
                        );
                    }
                    _ => {}
                }
            }
        }

        // stdout closed — take the child out of the map and await its exit.
        let child_opt = {
            let jobs_state = app_bg.state::<ActiveJobs>();
            let mut map = jobs_state.0.lock().unwrap();
            map.remove(&job_id_bg)
        };

        match child_opt {
            Some(mut child) => match child.wait().await {
                Ok(status) if status.success() => {
                    let file_name = std::path::Path::new(&output_path_bg)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&output_path_bg)
                        .to_string();
                    let _ = app_bg.notification()
                        .builder()
                        .title("Conversion complete")
                        .body(format!("{file_name} is ready"))
                        .show();
                    let _ = app_bg.emit(
                        "conversion-complete",
                        CompleteEvent {
                            job_id: job_id_bg,
                            output_path: output_path_bg,
                        },
                    );
                }
                Ok(_) => {
                    let file_name = std::path::Path::new(&output_path_bg)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&output_path_bg)
                        .to_string();
                    let _ = app_bg.notification()
                        .builder()
                        .title("Conversion failed")
                        .body(format!("{file_name} could not be converted"))
                        .show();
                    let _ = app_bg.emit(
                        "conversion-error",
                        ErrorEvent {
                            job_id: job_id_bg,
                            error: "ffmpeg exited with an error".to_string(),
                        },
                    );
                }
                Err(e) => {
                    let _ = app_bg.notification()
                        .builder()
                        .title("Conversion failed")
                        .body("An unexpected error occurred")
                        .show();
                    let _ = app_bg.emit(
                        "conversion-error",
                        ErrorEvent {
                            job_id: job_id_bg,
                            error: format!("Failed to wait for ffmpeg: {e}"),
                        },
                    );
                }
            },
            None => {
                // Child was removed by cancel_conversion — nothing to emit.
            }
        }
    });

    Ok(job_id)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Tauri command — starts a conversion and returns the job ID.
#[tauri::command]
pub async fn convert_file(
    input_path: String,
    settings: ConversionSettings,
    app: AppHandle,
) -> Result<String, String> {
    dispatch_conversion(input_path, settings, app).await
}

#[tauri::command]
pub async fn cancel_conversion(
    job_id: String,
    jobs: State<'_, ActiveJobs>,
) -> Result<(), String> {
    let child_opt = {
        let mut map = jobs.0.lock().map_err(|_| "job store lock poisoned".to_string())?;
        map.remove(&job_id)
    };
    if let Some(mut child) = child_opt {
        let _ = tokio::process::Child::kill(&mut child).await;
    }
    Ok(())
}

/// Move a file to the macOS Trash.  Returns an error string if the file is
/// missing or the OS refuses the move (e.g. permissions).
#[tauri::command]
pub async fn trash_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

/// Drains any buffered `job-started` events.  Called by the frontend on mount
/// to catch up on jobs dispatched before its listeners were attached (notably
/// dock-icon drops that cold-launch the app).
#[tauri::command]
pub async fn take_pending_job_starts(
    pending: State<'_, PendingJobStarts>,
) -> Result<Vec<JobStartedEvent>, String> {
    let mut buf = pending
        .0
        .lock()
        .map_err(|_| "pending store lock poisoned".to_string())?;
    Ok(std::mem::take(&mut *buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn non_mp4_output_keeps_stem_and_adds_mp4() {
        let out = make_output_path("/videos/clip.mkv").unwrap();
        assert_eq!(out, "/videos/clip.mp4");
    }

    #[test]
    fn mp4_input_gets_converted_suffix() {
        let out = make_output_path("/videos/clip.mp4").unwrap();
        assert_eq!(out, "/videos/clip-converted.mp4");
    }

    #[test]
    fn output_is_in_same_directory_as_input() {
        let out = make_output_path("/some/deep/path/video.mov").unwrap();
        assert!(out.starts_with("/some/deep/path/"));
    }

    #[test]
    fn mov_input_keeps_original_stem() {
        let out = make_output_path("/tmp/recording.mov").unwrap();
        assert_eq!(out, "/tmp/recording.mp4");
    }

    #[test]
    fn mkv_with_dots_in_stem() {
        let out = make_output_path("/tmp/my.video.mkv").unwrap();
        assert_eq!(out, "/tmp/my.video.mp4");
    }
}
