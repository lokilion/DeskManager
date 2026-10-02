use std::{path::PathBuf,
    time::{SystemTime, UNIX_EPOCH}
};
use tauri::{Emitter, Manager};
use crate::data::{self, card::{CardData, CardRegistry}};
use crate::services;
use crate::data::{card::*, icon_cache::IconCache};

#[tauri::command]
pub async fn create_new_card(app: tauri::AppHandle, card_name: &str) -> Result<(), String> {
    let system_time= SystemTime::now().duration_since(UNIX_EPOCH)
        .unwrap().as_millis();
    let card_label = format!("card-{}",system_time);
    let window = services::spawn_card_window::spawn_card_window(&app, &card_label, card_name)?;

    let card_data = CardData{
            file_vec: Vec::new(),
            card_name: card_name.to_string(),
            card_label: card_label.clone()
    };

    if let Err(e) = app.state::<CardRegistry>().mutate(|cards|{
        cards.insert(card_label, card_data);
        Ok(())
    }) {
        let _ = window.close();
        return Err(e);
    }
    
    app.emit("card-update", ()).map_err(|e|e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_card(app: tauri::AppHandle, card_label: &str) -> Result<(), String>{
    if let Some(window) = app.get_webview_window(&card_label){
        window.set_focus().map_err(|e|e.to_string())?;
        return Ok(());
    }

    let card_name = app.state::<CardRegistry>().unmutate(|cards|{
        cards.get(card_label).cloned().ok_or_else(||String::from("找不到对应卡片"))
    })?.card_name.clone();

    let _ = services::spawn_card_window::spawn_card_window(&app, card_label, &card_name)?;
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
pub async fn get_file_icon(app: tauri::AppHandle, path: String) -> Result<String, String> {
    if let Some(url) = app.state::<IconCache>().get(&path){
        return Ok(url);
    }

    let e_path = path.clone();
    let url = tauri::async_runtime::spawn_blocking(move ||{
        services::extract_icon::extract_icon(e_path)
    }).await.map_err(|e|e.to_string())??;

    app.state::<IconCache>().insert(path, url.clone());
    Ok(url)
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