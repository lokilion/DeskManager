use std::{
    collections::HashMap,
    path::PathBuf, 
    sync::Mutex, 
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileItem{
    pub name: String,
    pub path: PathBuf,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CardData{
    pub file_vec: Vec<FileItem>,
    pub card_name: String,
    pub card_label: String
}
pub struct CardRegistry {
    //make sure when mutiple window try to write cardregistry
    //resource compete wont happen
    //Card Label, Car Data
    pub cards: Mutex<HashMap<String, CardData>>,
}
impl CardRegistry {
    pub fn new()->Self{
        Self { cards: Mutex::new(HashMap::new()) }
    }
    pub fn add_file_to_card(&self, card_label: &str, files: Vec<FileItem>){
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