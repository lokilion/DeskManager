use std::{fs, path::PathBuf};

use crate::data::card::CardData;

//store the card data to local file
pub struct CardStore {
    //the path is where to store the file
    path: PathBuf,
}
impl CardStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Vec<CardData> {
        let bytes = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(_) => return Vec::new(),
        };

        match serde_json::from_slice::<Vec<CardData>>(&bytes) {
            Ok(cards) => cards,
            Err(error) => {
                eprintln!("[store] cards.json 解析失败，已备份并重置: {error}");
                let backup = self.path.with_extension("json.corrupt");
                //把本地文件标记为backup状态
                if let Err(rename_error) = std::fs::rename(&self.path, &backup) {
                    eprintln!("[store] 备份损坏文件失败: {rename_error}");
                }
                Vec::new()
            }
        }
    }

    pub fn save(&self, cards: &[CardData]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            //父目录不存在则一并创建
            fs::create_dir_all(parent).map_err(|e| format!("文件创建失败：{}", e))?;
        };

        let json = serde_json::to_vec_pretty(cards).map_err(|e| format!("序列化失败：{}", e))?;

        let pending = self
            .path
            .with_extension(format!("json.{}.pending", std::process::id()));

        //暂存与临时文件中，等成功完全写入后再重命名发布
        fs::write(&pending, &json).map_err(|e| format!("临时写入文件失败：{}", e))?;

        fs::rename(&pending, &self.path).map_err(|e| {
            let _ = fs::remove_file(&pending);
            format!("发布临时文件失败：{}", e)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::card::FileItem;

    /// 每个测试用独立文件名，避免并行测试互相踩踏
    fn temp_path(tag: &str) -> PathBuf {
        std::env::temp_dir().join(format!("dm-store-{}-{tag}.json", std::process::id()))
    }

    fn sample_card() -> CardData {
        CardData {
            file_vec: vec![FileItem {
                name: "示例.txt".to_string(),
                path: PathBuf::from("C:\\示例.txt"),
            }],
            card_name: "工作".to_string(),
            card_label: "card-1".to_string(),
        }
    }

    #[test]
    fn 缺少文件时返回空仓库() {
        let path = temp_path("missing");
        let _ = std::fs::remove_file(&path);
        assert!(CardStore::new(path).load().is_empty());
    }

    #[test]
    fn 写入后能原样读回() {
        let path = temp_path("roundtrip");
        let _ = std::fs::remove_file(&path);
        let store = CardStore::new(path.clone());

        store.save(&[sample_card()]).unwrap();
        let loaded = store.load();

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].card_name, "工作");
        assert_eq!(loaded[0].file_vec[0].name, "示例.txt");
        std::fs::remove_file(&path).unwrap();
    }

    #[test]
    fn 损坏的文件被备份而不是丢弃() {
        let path = temp_path("corrupt");
        let backup = path.with_extension("json.corrupt");
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(&backup);
        std::fs::write(&path, b"{ this is not json").unwrap();

        assert!(CardStore::new(path.clone()).load().is_empty());
        assert!(
            backup.exists(),
            "损坏文件必须被备份，否则用户数据无法人工抢救"
        );
        assert!(!path.exists(), "损坏文件应被移走，避免下次启动重复报错");

        std::fs::remove_file(&backup).unwrap();
    }

    #[test]
    fn 写入后不残留临时文件() {
        let path = temp_path("pending");
        let _ = std::fs::remove_file(&path);
        CardStore::new(path.clone()).save(&[sample_card()]).unwrap();

        let pending = path.with_extension(format!("json.{}.pending", std::process::id()));
        assert!(!pending.exists(), "临时文件必须已被 rename 掉");
        std::fs::remove_file(&path).unwrap();
    }
}
