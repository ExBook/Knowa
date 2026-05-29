// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    path::{Path, PathBuf},
};

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_backup_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
