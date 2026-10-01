//! 卡片仓库的落盘：一个 JSON 文件，写入走「临时文件 + rename」的原子发布。
//!
//! 设计要点：
//!   - `CardStore` 只管文件读写，不认识 Tauri、也不认识 `CardRegistry`，
//!     所以可以脱离应用直接单测（见文件末尾）。
//!   - 路径由外部注入，测试传临时目录即可，不用真的碰用户数据目录。

use crate::data::card::CardData;
use std::path::PathBuf;

pub struct CardStore {
    path: PathBuf,
}

impl CardStore {
    /// 绑定数据文件位置。这里不做任何 IO——构造不该失败，
    /// 「读不到文件」是 `load` 的语义，不是构造的语义。
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// 读取全部卡片。
    ///
    /// 三种情况都不算致命错误，一律降级成「从空仓库开始」：
    ///   - 文件不存在：首次启动；
    ///   - 文件损坏：备份成 `cards.json.corrupt` 再重置，绝不静默丢用户数据；
    ///   - 权限/IO 错误：只记日志，保证应用还能起来。
    pub fn load(&self) -> Vec<CardData> {
        let bytes = match std::fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
            Err(error) => {
                eprintln!("[store] 读取卡片仓库失败: {error}");
                return Vec::new();
            }
        };

        match serde_json::from_slice::<Vec<CardData>>(&bytes) {
            Ok(cards) => cards,
            Err(error) => {
                eprintln!("[store] cards.json 解析失败，已备份并重置: {error}");
                let backup = self.path.with_extension("json.corrupt");
                if let Err(rename_error) = std::fs::rename(&self.path, &backup) {
                    eprintln!("[store] 备份损坏文件失败: {rename_error}");
                }
                Vec::new()
            }
        }
    }

    /// 原子写入：先写同目录下的临时文件，再 rename 覆盖目标。
    ///
    /// 直接覆写目标文件的风险是写到一半崩溃会留下半截 JSON，
    /// 下次启动就变成「损坏 → 按上文逻辑整盘重置」，用户的卡片全没了。
    /// rename 在同一分区上是原子操作，所以目标文件要么是旧的完整内容、要么是新的完整内容。
    /// （`services/shell_thumbnail.rs` 里发布 PNG 用的是同一个套路。）
    pub fn save(&self, cards: &[CardData]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("创建数据目录失败: {error}"))?;
        }

        let json = serde_json::to_vec_pretty(cards)
            .map_err(|error| format!("序列化卡片失败: {error}"))?;

        // 带 pid 是为了多实例并存时互不踩踏
        let pending = self
            .path
            .with_extension(format!("json.{}.pending", std::process::id()));

        std::fs::write(&pending, &json).map_err(|error| format!("写入卡片失败: {error}"))?;

        std::fs::rename(&pending, &self.path).map_err(|error| {
            let _ = std::fs::remove_file(&pending);
            format!("发布卡片仓库失败: {error}")
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::card::FileItem;

    fn temp_path(tag: &str) -> PathBuf {
        std::env::temp_dir().join(format!("dm-store-{}-{tag}.json", std::process::id()))
    }

    fn sample_card(name: &str) -> CardData {
        CardData {
            file_vec: vec![FileItem {
                name: "示例.txt".to_string(),
                path: PathBuf::from("C:\\示例.txt"),
            }],
            card_name: name.to_string(),
            card_label: "card-1".to_string(),
        }
    }

    #[test]
    fn missing_file_loads_as_empty() {
        let path = temp_path("missing");
        let _ = std::fs::remove_file(&path);
        assert!(CardStore::new(path).load().is_empty());
    }

    #[test]
    fn save_then_load_round_trips() {
        let path = temp_path("roundtrip");
        let _ = std::fs::remove_file(&path);
        let store = CardStore::new(path.clone());

        store.save(&[sample_card("工作")]).unwrap();
        let loaded = store.load();

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].card_name, "工作");
        assert_eq!(loaded[0].file_vec[0].name, "示例.txt");
        std::fs::remove_file(&path).unwrap();
    }

    #[test]
    fn corrupt_file_is_backed_up_not_lost() {
        let path = temp_path("corrupt");
        let backup = path.with_extension("json.corrupt");
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(&backup);
        std::fs::write(&path, b"{ this is not json").unwrap();

        assert!(CardStore::new(path.clone()).load().is_empty());
        assert!(backup.exists(), "损坏文件必须被备份，否则用户数据无法人工抢救");
        assert!(!path.exists(), "损坏文件应被移走，避免下次启动重复报错");

        std::fs::remove_file(&backup).unwrap();
    }

    #[test]
    fn save_leaves_no_pending_file() {
        let path = temp_path("pending");
        let _ = std::fs::remove_file(&path);
        CardStore::new(path.clone()).save(&[sample_card("清理")]).unwrap();

        let pending = path.with_extension(format!("json.{}.pending", std::process::id()));
        assert!(!pending.exists(), "临时文件必须已被 rename 掉");
        std::fs::remove_file(&path).unwrap();
    }
}
