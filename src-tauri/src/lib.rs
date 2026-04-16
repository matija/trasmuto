mod commands;
mod ffmpeg;
mod models;

use commands::{cancel_conversion, convert_file, dispatch_conversion, get_ffmpeg_path, get_settings, load_settings, probe_file, save_settings, ActiveJobs};
use tauri::{Emitter, Manager};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "ts", "mts", "m2ts",
];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveJobs::default())
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

                println!("[Opened] dispatching {} file(s): {:?}", paths.len(), paths);

                // Show and focus the window so the user sees progress immediately.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Notify the frontend so it can add pending items to the queue UI.
                    let _ = window.emit("file-opened", &paths);
                }

                // Load persisted settings; falls back to defaults if none saved yet.
                let settings = load_settings(app);

                // Dispatch one conversion job per file.  Each runs in its own async task so
                // multiple dock drops execute concurrently.
                for path in paths {
                    let app_handle = app.clone();
                    let settings_clone = settings.clone();
                    tauri::async_runtime::spawn(async move {
                        match dispatch_conversion(path.clone(), settings_clone, app_handle).await {
                            Ok(job_id) => {
                                println!("[Opened] started job {job_id} for {path}");
                            }
                            Err(e) => {
                                eprintln!("[Opened] failed to start conversion for {path}: {e}");
                            }
                        }
                    });
                }
            }
        });
}
