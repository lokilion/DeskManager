mod services;
mod commands;
mod data;

use crate::commands::card_commands::*;
use crate::data::card::CardRegistry;

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
