use crate::models::ConversionSettings;

#[tauri::command]
pub async fn convert_file(input_path: String, settings: ConversionSettings) -> Result<String, String> {
    // TODO Phase 2: spawn ffmpeg, stream progress events, return job ID
    let job_id = format!("job-{}", uuid_simple());
    println!("[stub] convert_file: {} -> job {}", input_path, job_id);
    Ok(job_id)
}

#[tauri::command]
pub async fn cancel_conversion(job_id: String) -> Result<(), String> {
    // TODO Phase 2: kill ffmpeg child process for this job
    println!("[stub] cancel_conversion: {}", job_id);
    Ok(())
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:x}", t)
}
