// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{Manager, RunEvent, WindowEvent};

fn path_to_string(path: PathBuf) -> Result<String, String> {
    path.into_os_string()
        .into_string()
        .map_err(|_| "路径包含无法显示的字符".to_string())
}

#[tauri::command]
fn write_backup_file(directory: String, filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let filename_path = Path::new(&filename);
    let has_separator = filename.contains('/') || filename.contains('\\');
    if filename_path.components().count() != 1 || has_separator || !filename.ends_with(".exlocal") {
        return Err("备份文件名不合法".to_string());
    }

    let directory_path = PathBuf::from(directory);
    fs::create_dir_all(&directory_path).map_err(|error| format!("创建备份目录失败：{error}"))?;
    let target_file = directory_path.join(filename);
    fs::write(&target_file, bytes).map_err(|error| format!("写入备份文件失败：{error}"))?;
    path_to_string(target_file)
}

fn validate_export_file(path: &Path) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if path.file_name().is_none() || !matches!(extension.as_str(), "exlocal" | "exbank" | "pdf") {
        return Err("导出文件类型不受支持".to_string());
    }

    Ok(())
}

#[tauri::command]
fn write_export_file(path: String, bytes: Vec<u8>) -> Result<String, String> {
    let target_file = PathBuf::from(path);
    validate_export_file(&target_file)?;

    if let Some(directory) = target_file.parent() {
        fs::create_dir_all(directory).map_err(|error| format!("创建导出目录失败：{error}"))?;
    }

    fs::write(&target_file, bytes).map_err(|error| format!("写入导出文件失败：{error}"))?;
    path_to_string(target_file)
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_backup_file, write_export_file])
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
    });
}
