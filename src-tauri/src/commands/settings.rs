use crate::models::ConversionSettings;

#[tauri::command]
pub async fn get_settings() -> Result<ConversionSettings, String> {
    // TODO Phase 4: load from tauri-plugin-store
    println!("[stub] get_settings");
    Ok(ConversionSettings::default())
}

#[tauri::command]
pub async fn save_settings(settings: ConversionSettings) -> Result<(), String> {
    // TODO Phase 4: persist via tauri-plugin-store
    println!("[stub] save_settings: {:?}", settings);
    Ok(())
}

#[tauri::command]
pub async fn get_ffmpeg_path() -> Result<Option<String>, String> {
    use crate::ffmpeg::finder;
    Ok(finder::find_ffmpeg(None))
}
