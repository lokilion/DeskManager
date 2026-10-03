use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};

use crate::services::store_data::CardStore;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub name: String,
    pub path: PathBuf,
}
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CardData {
    pub file_vec: Vec<FileItem>,
    pub card_name: String,
    pub card_label: String,
}
pub struct CardRegistry {
    //make sure when mutiple window try to write cardregistry
    //resource compete wont happen
    //Card Label, Car Data
    cards: Mutex<HashMap<String, CardData>>,
    store: CardStore,
}
impl CardRegistry {
    pub fn new(path: PathBuf) -> Self {
        let store = CardStore::new(path);
        let cards = store
            .load()
            .into_iter()
            .map(|card| (card.card_label.clone(), card))
            .collect();

        Self {
            cards: Mutex::new(cards),
            store: store,
        }
    }

    pub fn mutate<T>(
        &self,
        change_fn: impl FnOnce(&mut HashMap<String, CardData>) -> Result<T, String>,
    ) -> Result<T, String> {
        let (result, snapshot) = {
            let mut cards = self.cards.lock().map_err(|e| e.to_string())?;
            let result = change_fn(&mut cards)?;
            let snapshot = cards.values().cloned().collect::<Vec<_>>();
            (result, snapshot)
        };

        self.store.save(&snapshot)?;

        Ok(result)
    }

    pub fn unmutate<T>(
        &self,
        change_fn: impl FnOnce(&HashMap<String, CardData>) -> Result<T, String>,
    ) -> Result<T, String> {
        let result = {
            let mut cards = self.cards.lock().map_err(|e| e.to_string())?;
            let result = change_fn(&mut cards)?;
            result
        };
        Ok(result)
    }

    pub fn add_file_to_card(&self, card_label: &str, files: Vec<FileItem>) -> Result<(), String> {
        self.mutate(|cards| {
            if let Some(card) = cards.get_mut(card_label) {
                files.into_iter().for_each(|file| {
                    let exist = card.file_vec.iter().any(|f| f.path == file.path);
                    if !exist {
                        card.file_vec.push(file);
                    }
                });
            };
            Ok(())
        })?;
        Ok(())
    }

    pub fn remove_file_from_card(&self, card_label: &str, paths:Vec<PathBuf>) -> Result<(), String> {
        self.mutate(|cards|{
            let card = cards.get_mut(card_label).ok_or("找不到该窗口")?;
            card.file_vec.retain(|file| !paths.contains(&file.path));
            Ok(())
        })?;
        Ok(())
    }
}
