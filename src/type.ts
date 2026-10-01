export interface FileItem{
    name: string,
    path: string
}
export interface CardData{
    fileVec: FileItem[],
    cardName: string,
    cardLabel: string
}

export type ViewSize = "small" | "medium" | "large";