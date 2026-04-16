use crate::models::FileInfo;

#[tauri::command]
pub async fn probe_file(path: String) -> Result<FileInfo, String> {
    // TODO Phase 2: run ffprobe, parse JSON output
    println!("[stub] probe_file: {}", path);
    Ok(FileInfo {
        path,
        duration_ms: None,
        width: None,
        height: None,
        video_codec: None,
        audio_codec: None,
    })
}
