mod services;
mod commands;
mod data;

use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, WebviewWindowBuilder};
use window_vibrancy::apply_acrylic;
use crate::commands::card_commands::*;
use crate::data::card::{CardData, CardRegistry};

#[tauri::command]
async fn create_new_card(app: tauri::AppHandle, card_name: &str) -> Result<(), String> {
    let system_time= SystemTime::now().duration_since(UNIX_EPOCH)
        .unwrap().as_millis();
    let card_label = format!("card-{}",system_time);
    let window = WebviewWindowBuilder::new(
        &app,
        &card_label,
        tauri::WebviewUrl::App("index.html".into())
    )
    .title(card_name)
    .inner_size(300.0, 400.0)
    .decorations(false)
    .transparent(true)
    .resizable(true)
    .maximizable(false)
    .build()
    .map_err(|e|e.to_string())?;

    apply_acrylic(&window, Some((255, 255, 255, 64))).map_err(|e|e.to_string())?;


    let registry = app.state::<CardRegistry>();
    let mut cards = registry.cards.lock().unwrap();
    let card_data = CardData{
            file_vec: Vec::new(),
            card_name: card_name.to_string(),
            card_label: card_label.clone()
    };
    cards.insert(card_label, card_data);
    
    Ok(())
}

#[tauri::command]
fn close_card(app: tauri::AppHandle, card_label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&card_label) {
        win.close().map_err(|e|e.to_string())?;
    }
    let registry = app.state::<CardRegistry>();
    let mut cards = registry.cards.lock().unwrap();
    cards.remove(&card_label);
    app.emit("card-update", ()).map_err(|e|e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(CardRegistry::new())
        .invoke_handler(tauri::generate_handler![
            create_new_card,
            close_card,
            add_file_to_card,
            rename_card,
            reorder_card_files,
            get_file_icon,
            get_card_files,
            get_card,
            list_cards,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
