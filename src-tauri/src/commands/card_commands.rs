use std::{path::PathBuf,
    time::{SystemTime, UNIX_EPOCH}
};
use tauri::{Emitter, Manager};
use crate::data::card::{CardData, CardRegistry};
use crate::services;
use crate::data::card::*;

#[tauri::command]
pub async fn create_new_card(app: tauri::AppHandle, card_name: &str) -> Result<(), String> {
    let system_time= SystemTime::now().duration_since(UNIX_EPOCH)
        .unwrap().as_millis();
    let card_label = format!("card-{}",system_time);
    let _ = services::spawn_card_window::spawn_card_window(&app, &card_label, card_name)?;

    let card_data = CardData{
            file_vec: Vec::new(),
            card_name: card_name.to_string(),
            card_label: card_label.clone()
    };
    app.state::<CardRegistry>().mutate(|cards|{
        cards.insert(card_label, card_data);
        Ok(())
    })?;
    
    app.emit("card-update", ()).map_err(|e|e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn close_card(app: tauri::AppHandle, card_label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&card_label) {
        win.close().map_err(|e|e.to_string())?;
    }
    app.state::<CardRegistry>().mutate(|cards|{
        cards.remove(&card_label);
        Ok(())
    })?;

    app.emit("card-update", ()).map_err(|e|e.to_string())?;

    Ok(())
}

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

        registry.add_file_to_card(&card_label, files)?;

    app.emit("card-update", ()).map_err(|e|e.to_string())?;

    Ok(())
}
#[tauri::command]
pub fn rename_card(app: tauri::AppHandle, card_label: String, new_name: String) -> Result<(), String> {
    app.state::<CardRegistry>().mutate(|cards|{
        let card = cards.get_mut(&card_label).ok_or("找不到该窗口")?;
        card.card_name = new_name.clone();
        Ok(())
    })?;

    if let Some(win) = app.get_webview_window(&card_label) {
        win.set_title(&new_name).map_err(|e|e.to_string())?;
    }

    app.emit("card-update", ()).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn reorder_card_files(app: tauri::AppHandle, card_label: String, order: Vec<PathBuf>) -> Result<(), String> {
    app.state::<CardRegistry>().mutate(|cards|{
        let card = cards.get_mut(&card_label).ok_or("找不到该窗口")?;
        card.file_vec.sort_by_key(|f|{
            order.iter().position(|p| p == &f.path).unwrap_or(usize::MAX)
        });
        Ok(())
    })?;

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
    app.state::<CardRegistry>().unmutate(|cards|{
        let card = cards.get(&card_label).ok_or("找不到该窗口")?;
        Ok(card.file_vec.clone())
    })
    
}

#[tauri::command]
pub fn get_card(app: tauri::AppHandle, card_label: String) -> Result<CardData, String> {
    app.state::<CardRegistry>().unmutate(|cards|{
        let card = cards.get(&card_label).ok_or("找不到该窗口")?;
        Ok(card.clone())
    })
}

#[tauri::command]
pub fn list_cards(app: tauri::AppHandle) -> Result<Vec<CardData>, String> {
    app.state::<CardRegistry>().unmutate(|cards|{
        Ok(cards.values().cloned().collect())
    })
}