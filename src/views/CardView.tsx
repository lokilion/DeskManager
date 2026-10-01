import { useEffect, useState } from "react";
import { CardData, FileItem, ViewSize } from "../type";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import CardFileItem from "../component/CardFileItem";
import "./CardView.css";

function CardView({ cardLabel }: { cardLabel: string }) {
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [files, setFiles] = useState<FileItem[]>([])
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
            <CardFileItem files={files} viewSize={viewSize}/>
        </main>
    );
}

export default CardView;