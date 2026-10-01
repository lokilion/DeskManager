import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { CardData, FileItem } from "../type";

/** 后端广播的事件名。写成一个常量，避免前端写 "card-update"、后端写别的字符串，拼错了谁都不报错 */
export const CARD_UPDATED = "card-update";

export function listCards(): Promise<CardData[]> {
  return invoke("list_cards");
}

export function getCard(cardLabel: string): Promise<CardData> {
  return invoke("get_card", { cardLabel });
}

export function getCardFiles(cardLabel: string): Promise<FileItem[]> {
  return invoke("get_card_files", { cardLabel });
}

export function createCard(cardName: string): Promise<void> {
  return invoke("create_new_card", { cardName });
}

export function closeCard(cardLabel: string): Promise<void> {
  return invoke("close_card", { cardLabel });
}

export function renameCard(cardLabel: string, newName: string): Promise<void> {
  return invoke("rename_card", { cardLabel, newName });
}

export function addFileToCard(cardLabel: string, paths: string[]): Promise<void> {
  return invoke("add_file_to_card", { cardLabel, paths });
}

export function reorderCardFiles(cardLabel: string, order: string[]): Promise<void> {
  return invoke("reorder_card_files", { cardLabel, order });
}

export function getFileIcon(path: string): Promise<string> {
  return invoke("get_file_icon", { path });
}

export function onCardUpdated(handler: () => void): Promise<UnlistenFn> {
  return listen(CARD_UPDATED, () => handler());
}