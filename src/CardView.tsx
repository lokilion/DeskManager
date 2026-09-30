import { useEffect, useState } from "react";
import { CardData, FileItem } from "./type";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

type ViewSize = "small" | "medium" | "large";

function FileIcon({ path }: { path: string }) {
    const [icon, setIcon] = useState("");

    useEffect(() => {
        invoke<string>("get_file_icon", { path: path })
            .then(setIcon)
            .catch(() => setIcon(""));
    }, [path]);

    return <img className="file-preview" src={icon} alt="" draggable={false} />;
}

function CardView({ cardLabel }: { cardLabel: string }) {
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [cardName, setCardName] = useState("");

    // 新增：菜单与视图大小
    const [menuOpen, setMenuOpen] = useState(false);
    const [viewSize, setViewSize] = useState<ViewSize>("medium");

    function startRename() {
        setDraftName(cardName);
        setEditing(true);
    }
    async function commitRename() {
        setEditing(false);
        const newName = draftName.trim();
        if (newName && newName != cardName) {
            await invoke("rename_card", { cardLabel: cardLabel, newName: newName });
            setCardName(newName);
        }
    }

    function startReoder(index: number) {
        setDragIndex(index);
    }
    function endDrag() {
        setDragIndex(null);
        setDragOverIndex(null);
    }
    function endReoder(index: number) {
        if (dragIndex === null || dragIndex === index) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }
        const newFiles = [...files];
        const [moved] = newFiles.splice(dragIndex, 1);
        const target = dragIndex < index ? index - 1 : index;
        newFiles.splice(target, 0, moved);
        setFiles(newFiles);
        setDragIndex(null);
        setDragOverIndex(null);
        invoke("reorder_card_files", {
            cardLabel: cardLabel,
            order: newFiles.map((f) => f.path),
        });
    }

    function isImage(name: string) {
        return /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(name);
    }

    async function refresh() {
        invoke<CardData>("get_card", { cardLabel: cardLabel })
            .then((card) => {
                setCardName(card.card_name);
                setFiles(card.file_vec);
            });
    }
    async function handleClose() {
        await invoke("close_card", { cardLabel: cardLabel });
    }

    useEffect(() => { refresh(); }, [cardLabel]);

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        getCurrentWebview()
            .onDragDropEvent((e) => {
                if (e.payload.type === "drop") {
                    invoke("add_file_to_card", {
                        cardLabel: cardLabel,
                        paths: e.payload.paths,
                    }).then(refresh);
                }
            })
            .then((fn) => { unlisten = fn; });

        return () => { unlisten?.(); };
    }, [cardLabel]);

    return (
        <main className="card">
            <header className="card-header">
                {editing ? (
                    <input
                        className="card-name-input"
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.currentTarget.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setEditing(false);
                        }}
                    />
                ) : (
                    <div className="card-drag" data-tauri-drag-region onDoubleClick={startRename}>
                        {cardName}
                    </div>
                )}

                {/* 菜单按钮 */}
                <button className="card-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>⋯</button>
                {/* 关闭按钮 */}
                <button className="card-close" onClick={handleClose}>×</button>

                {/* 下拉菜单 */}
                {menuOpen && (
                    <>
                        <div className="card-menu-mask" onClick={() => setMenuOpen(false)} />
                        <div className="card-menu">
                            <div className="card-menu-title">视图大小</div>
                            <button
                                className={"card-menu-item" + (viewSize === "small" ? " active" : "")}
                                onClick={() => { setViewSize("small"); setMenuOpen(false); }}
                            >
                                小
                            </button>
                            <button
                                className={"card-menu-item" + (viewSize === "medium" ? " active" : "")}
                                onClick={() => { setViewSize("medium"); setMenuOpen(false); }}
                            >
                                中
                            </button>
                            <button
                                className={"card-menu-item" + (viewSize === "large" ? " active" : "")}
                                onClick={() => { setViewSize("large"); setMenuOpen(false); }}
                            >
                                大
                            </button>
                            {/* <div className="card-menu-sep" />
                            <button className="card-menu-item danger" onClick={handleClose}>
                                关闭窗口
                            </button> */}
                        </div>
                    </>
                )}
            </header>

            <ul className={"card-files size-" + viewSize}>
                {files.map((file, index) => (
                    <li
                        key={file.path}
                        className={
                            "file-item" +
                            (dragIndex === index ? " dragging" : "") +
                            (dragOverIndex === index ? " drag-over" : "")
                        }
                        draggable
                        onDragStart={() => startReoder(index)}
                        onDragEnd={endDrag}
                        onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOverIndex !== index) setDragOverIndex(index);
                        }}
                        onDrop={() => endReoder(index)}
                    >
                        {isImage(file.name) ? (
                            <img
                                className="file-preview"
                                src={convertFileSrc(file.path)}
                                alt={file.name}
                                draggable={false}
                            />
                        ) : (
                            <FileIcon path={file.path} />
                        )}
                        <div className="file-name" title={file.name}>{file.name}</div>
                    </li>
                ))}
            </ul>
        </main>
    );
}

export default CardView;