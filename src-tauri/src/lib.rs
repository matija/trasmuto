mod commands;
mod ffmpeg;
mod models;

use commands::{cancel_conversion, convert_file, get_ffmpeg_path, get_settings, probe_file, save_settings};
use tauri::{Emitter, Manager};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "ts", "mts", "m2ts",
];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            convert_file,
            cancel_conversion,
            probe_file,
            get_settings,
            save_settings,
            get_ffmpeg_path,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|p| {
                        p.extension()
                            .and_then(|e| e.to_str())
                            .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
                            .unwrap_or(false)
                    })
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();

                if paths.is_empty() {
                    return;
                }

                println!("[Opened] received {} file(s): {:?}", paths.len(), paths);

                // Emit file-opened event so the frontend can populate the queue.
                // Window focus happens here too so the user sees progress.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("file-opened", &paths);
                }
            }
        });
}
