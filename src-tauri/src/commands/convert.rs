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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_output_path(input: &str) -> Result<String, String> {
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
