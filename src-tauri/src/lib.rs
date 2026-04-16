mod commands;
pub mod ffmpeg;
pub mod models;

use commands::{
    cancel_conversion, convert_file, dispatch_conversion, get_ffmpeg_path, get_settings,
    load_settings, probe_file, save_settings, take_pending_job_starts, ActiveJobs,
    PendingJobStarts,
};
use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

#[cfg(target_os = "macos")]
use tauri::utils::{config::WindowEffectsConfig, WindowEffect, WindowEffectState};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "ts", "mts", "m2ts",
];

/// Extract and validate supported video file paths from the `Opened` event URLs.
#[cfg(any(target_os = "macos", target_os = "ios"))]
fn extract_supported_paths(urls: &[tauri::Url]) -> Vec<String> {
    urls.iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|p| p.to_string_lossy().to_string())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveJobs::default())
        .manage(PendingJobStarts::default())
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
            take_pending_job_starts,
        ])
        .setup(|app| {
            // Request macOS notification permission on first launch.
            let _ = app.notification().request_permission();

            // Apply native macOS vibrancy to the main window so the app feels
            // like a first-party Apple utility (translucent material that
            // reflects the desktop behind it, follows system light/dark).
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                // `Sidebar` gives the same translucent material used by Finder's
                // sidebar / Notes / Mail — it tracks system light/dark mode and
                // makes the app feel like a first-party Apple utility.
                let _ = window.set_effects(WindowEffectsConfig {
                    effects: vec![WindowEffect::Sidebar],
                    state: Some(WindowEffectState::FollowsWindowActiveState),
                    radius: None,
                    color: None,
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = extract_supported_paths(&urls);
                if paths.is_empty() {
                    return;
                }

                // Show and focus the window so the user sees progress immediately.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Nudge the frontend to switch to the Queue tab (buffered
                    // in PendingJobStarts anyway, so losing this is harmless).
                    let _ = window.emit("file-opened", &paths);
                }

                // Load persisted settings; falls back to defaults if none saved yet.
                let settings = load_settings(app);

                // Dispatch one conversion job per file.  dispatch_conversion
                // itself emits `job-started` and buffers it for the frontend.
                for path in paths {
                    let app_handle = app.clone();
                    let settings_clone = settings.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) =
                            dispatch_conversion(path.clone(), settings_clone, app_handle).await
                        {
                            eprintln!("[Opened] failed to start conversion for {path}: {e}");
                        }
                    });
                }
            }
        });
}
