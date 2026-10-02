use std::{collections::HashMap, sync::Mutex};

pub struct IconCache {
    //file path, icon url
    cache: Mutex<HashMap<String, String>>,
}
impl IconCache {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
        }
    }
    pub fn get(&self, path: &str) -> Option<String> {
        self.cache.lock().ok()?.get(path).cloned()
    }
    pub fn insert(&self, path: String, url: String) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(path, url);
        }
    }
}
