use std::{
    collections::{BTreeMap, HashMap}, path::PathBuf, sync::{Mutex, MutexGuard}, 
};
use serde::{Deserialize, Serialize, de};

use crate::services::store_data::CardStore;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileItem{
    pub name: String,
    pub path: PathBuf,
}
#[derive(Serialize, Deserialize, Clone, Debug)]
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
    store: CardStore,
}
impl CardRegistry {
    pub fn new(path: PathBuf)->Self{
        Self { 
            cards: Mutex::new(HashMap::new()),
            store: CardStore::new(path),
        }
    }

    pub fn mutate<T>(
        &self,
        change_fn: impl FnOnce(&mut HashMap<String, CardData>) -> Result<T, String>
    ) -> Result<T, String> 
    {
        let (result, snapshot) = {
            let mut cards = self.cards.lock()
                .map_err(|e|e.to_string())?;
            let result = change_fn(&mut cards)?;
            let snapshot = cards.values().cloned().collect::<Vec<_>>();
            (result, snapshot)
        };
        self.store.save(&snapshot)?;

        Ok(result)
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