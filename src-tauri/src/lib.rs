mod commands;
mod data;
mod services;

use tauri::Manager;
use tauri_plugin_window_state::{StateFlags, WindowExt};

use crate::commands::card_commands::*;
use crate::data::{card::CardRegistry, icon_cache::IconCache};
use services::spawn_card_window::spawn_card_window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(IconCache::new())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let registry = CardRegistry::new(data_dir.join("cards.json"));
            let cards = registry
                .unmutate(|cards| Ok(cards.values().cloned().collect::<Vec<_>>()))
                .unwrap_or_else(|e| {
                    eprintln!("初始化卡片失败：{e}");
                    Vec::new()
                });

            app.manage(registry);

            cards.into_iter().for_each(|card| {
                match spawn_card_window(app.handle(), &card.card_label, &card.card_name) {
                    Ok(window) =>{
                        if let Err(restore_e) = window.restore_state(StateFlags::POSITION|StateFlags::SIZE){
                            eprintln!("[startup]初始化卡片位置/大小信息失败：{restore_e}");
                        }
                    },
                    Err(e) => {eprintln!("[startup]创建卡片失败：{e}");}
                }
            });

            Ok(())
        })
        //.manage(CardRegistry::new(PathBuf::from("./cards_json/cards.json")))
        .invoke_handler(tauri::generate_handler![
            create_new_card,
            open_card,
            close_card,
            open_file,
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
