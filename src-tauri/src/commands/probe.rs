use serde::Deserialize;
use crate::ffmpeg::finder;
use crate::models::FileInfo;

#[derive(Deserialize)]
struct FfprobeOutput {
    streams: Vec<FfprobeStream>,
    format: FfprobeFormat,
}

#[derive(Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
}

#[tauri::command]
pub async fn probe_file(path: String) -> Result<FileInfo, String> {
    let ffprobe = finder::find_ffprobe(None)
        .ok_or_else(|| "ffprobe not found. Install via: brew install ffmpeg".to_string())?;

    let output = tokio::process::Command::new(&ffprobe)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            &path,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffprobe: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let probe: FfprobeOutput = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {e}"))?;

    let duration_ms = probe
        .format
        .duration
        .and_then(|d| d.parse::<f64>().ok())
        .map(|s| (s * 1000.0) as u64);

    let video = probe.streams.iter().find(|s| s.codec_type.as_deref() == Some("video"));
    let audio = probe.streams.iter().find(|s| s.codec_type.as_deref() == Some("audio"));

    Ok(FileInfo {
        path,
        duration_ms,
        width: video.and_then(|s| s.width),
        height: video.and_then(|s| s.height),
        video_codec: video.and_then(|s| s.codec_name.clone()),
        audio_codec: audio.and_then(|s| s.codec_name.clone()),
    })
}
