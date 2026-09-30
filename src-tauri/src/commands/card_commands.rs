use std::path::PathBuf;
use tauri::{Emitter, Manager};
use crate::services;
use crate::data::card::*;

#[tauri::command]
pub fn add_file_to_card(app: tauri::AppHandle, card_label: String, paths: Vec<PathBuf>) -> Result<(), String>{
    let registry = app.state::<CardRegistry>();
    let files: Vec<FileItem> = paths.into_iter()
        .filter_map(|path|{
            let name  = path
                .file_name()?
                .to_string_lossy()
                .to_string();
            Some(FileItem{ name, path })
        })
        .collect();

    registry.add_file_to_card(&card_label, files);

    app.emit("card-update", ()).map_err(|e|e.to_string())?;

    Ok(())
}
#[tauri::command]
pub fn rename_card(app: tauri::AppHandle, card_label: String, new_name: String) -> Result<(), String> {
    let registry = app.state::<CardRegistry>();
    let mut cards = registry.cards.lock().unwrap();
    let card = cards.get_mut(&card_label).ok_or("找不到该窗口")?;
    card.card_name = new_name.clone();

    if let Some(win) = app.get_webview_window(&card_label) {
        win.set_title(&new_name).map_err(|e|e.to_string())?;
    }
    app.emit("card-update", ()).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn reorder_card_files(app: tauri::AppHandle, card_label: String, order: Vec<PathBuf>) -> Result<(), String> {
    let registry = app.state::<CardRegistry>();
    let mut cards = registry.cards.lock().unwrap();
    let card = cards.get_mut(&card_label).ok_or("找不到该窗口")?;

    card.file_vec.sort_by_key(|f|{
        order.iter().position(|p| p == &f.path).unwrap_or(usize::MAX)
    });

    app.emit("card-update", ()).map_err(|e|e.to_string())?;
    Ok(())
}

//Read feature
#[tauri::command]
pub fn get_file_icon(path: String) -> Result<String, String> {
    use base64::Engine;
    use std::hash::{Hash, Hasher};

    // 用路径哈希生成一个临时输出文件，避免不同文件撞名
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    let out = std::env::temp_dir().join(format!("dm-icon-{:016x}.png", hasher.finish()));

    // 调你搬进来的 shell_thumbnail，把「关联图标」存成 PNG
    services::shell_thumbnail::save_shell_icon_png(&path, &out)?;

    // 读出来 → base64 → 拼成 data URL
    let bytes = std::fs::read(&out).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&out);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub fn get_card_files(app: tauri::AppHandle, card_label: String) -> Result<Vec<FileItem>, String>{
    let registry = app.state::<CardRegistry>();
    let cards = registry.cards.lock().unwrap();
    let card = cards.get(&card_label).ok_or("找不到该窗口")?;

    Ok(card.file_vec.clone())
}

#[tauri::command]
pub fn get_card(app: tauri::AppHandle, card_label: String) -> Result<CardData, String> {
    let registry = app.state::<CardRegistry>();
    let cards = registry.cards.lock().unwrap();
    let card = cards.get(&card_label).ok_or("找不到该窗口")?;

    Ok(card.clone())
}

#[tauri::command]
pub fn list_cards(app: tauri::AppHandle) -> Result<Vec<CardData>, String> {
    let registry = app.state::<CardRegistry>();
    let cards = registry.cards.lock().unwrap();
    Ok(cards.values().cloned().collect())
}