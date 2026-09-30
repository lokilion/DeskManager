use std::{
    collections::HashMap,
    path::PathBuf, 
    sync::Mutex, 
    time::{SystemTime, UNIX_EPOCH}
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewWindowBuilder};
use window_vibrancy::apply_acrylic;

mod services;

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

//file map logic
#[derive(Serialize, Deserialize, Clone)]
struct FileItem{
    name: String,
    path: PathBuf,
}
#[derive(Serialize, Deserialize, Clone)]
struct CardData{
    file_vec: Vec<FileItem>,
    card_name: String,
    card_label: String
}
struct CardRegistry {
    //make sure when mutiple window try to write cardregistry
    //resource compete wont happen
    //Card Label, Car Data
    cards: Mutex<HashMap<String, CardData>>,
}
impl CardRegistry {
    fn new()->Self{
        Self { cards: Mutex::new(HashMap::new()) }
    }
    fn add_file_to_card(&self, card_label: &str, files: Vec<FileItem>){
        let mut cards = self.cards.lock().unwrap();
        if let Some(card) = cards.get_mut(card_label){
            files.into_iter().for_each(|file|{
                let exist = card.file_vec
                    .iter().any(|f| f.path == file.path);
                if !exist{
                    card.file_vec.push(file);
                }
            });
        }
    }
}

#[tauri::command]
fn add_file_to_card(app: tauri::AppHandle, card_label: String, paths: Vec<PathBuf>) -> Result<(), String>{
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
fn rename_card(app: tauri::AppHandle, card_label: String, new_name: String) -> Result<(), String> {
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
fn reorder_card_files(app: tauri::AppHandle, card_label: String, order: Vec<PathBuf>) -> Result<(), String> {
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
fn get_file_icon(path: String) -> Result<String, String> {
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
fn get_card_files(app: tauri::AppHandle, card_label: String) -> Result<Vec<FileItem>, String>{
    let registry = app.state::<CardRegistry>();
    let cards = registry.cards.lock().unwrap();
    let card = cards.get(&card_label).ok_or("找不到该窗口")?;

    Ok(card.file_vec.clone())
}

#[tauri::command]
fn get_card(app: tauri::AppHandle, card_label: String) -> Result<CardData, String> {
    let registry = app.state::<CardRegistry>();
    let cards = registry.cards.lock().unwrap();
    let card = cards.get(&card_label).ok_or("找不到该窗口")?;

    Ok(card.clone())
}

#[tauri::command]
fn list_cards(app: tauri::AppHandle) -> Result<Vec<CardData>, String> {
    let registry = app.state::<CardRegistry>();
    let cards = registry.cards.lock().unwrap();
    Ok(cards.values().cloned().collect())
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
