pub fn extract_icon(path: String) -> Result<String, String> {
    use super::shell_thumbnail;
    use base64::Engine;
    use std::hash::{Hash, Hasher};

    // 用路径哈希生成一个临时输出文件，避免不同文件撞名
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    let out = std::env::temp_dir().join(format!("dm-icon-{:016x}.png", hasher.finish()));

    // 调你搬进来的 shell_thumbnail，把「关联图标」存成 PNG
    shell_thumbnail::save_shell_icon_png(&path, &out)?;

    // 读出来 → base64 → 拼成 data URL
    let bytes = std::fs::read(&out).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&out);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}
