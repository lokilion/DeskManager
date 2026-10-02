use tauri::WebviewWindowBuilder;
use window_vibrancy::apply_acrylic;

pub fn spawn_card_window(
    app: &tauri::AppHandle,
    card_label: &str,
    card_name :&str
) -> Result<tauri::WebviewWindow, String>{
    let window: tauri::WebviewWindow = WebviewWindowBuilder::new(
        app,
        card_label,
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

    if let Err(e) = apply_acrylic(&window, Some((255, 255, 255, 64))).map_err(|e|e.to_string()){
        eprintln!("毛玻璃效果应用失败：{e}");
    }

    Ok(window)
}