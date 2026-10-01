export interface FileItem{
    name: string,
    path: string
}
export interface CardData{
    file_vec: FileItem[],
    card_name: string,
    card_label: string
}

export type ViewSize = "small" | "medium" | "large";