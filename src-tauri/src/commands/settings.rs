use crate::models::ConversionSettings;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

pub fn load_settings(app: &AppHandle) -> ConversionSettings {
    let Ok(store) = app.store(STORE_FILE) else {
        return ConversionSettings::default();
    };
    store
        .get(SETTINGS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<ConversionSettings, String> {
    Ok(load_settings(&app))
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: ConversionSettings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(
        SETTINGS_KEY,
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ffmpeg_path() -> Result<Option<String>, String> {
    use crate::ffmpeg::finder;
    Ok(finder::find_ffmpeg(None))
}
