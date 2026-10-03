import { useState } from "react";
import { closeCard, renameCard } from "../api/card";
import { ViewSize } from "../type";

type Props = {
    cardLabel: string;
    cardName: string;
    viewSize: ViewSize;
    onViewSizeChange: ((size: ViewSize)=>void);
};
function CardHeader( {cardLabel, cardName, viewSize, onViewSizeChange}: Props ){

    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState("");

    // 菜单与视图大小
    const [menuOpen, setMenuOpen] = useState(false);
    

    function startRename() {
        setDraftName(cardName);
        setEditing(true);
    }
    async function commitRename() {
        setEditing(false);
        const newName = draftName.trim();
        if (newName && newName != cardName) {
            await renameCard( cardLabel, newName );
        }
    }

    async function handleClose() {
        await closeCard( cardLabel );
    }

    return (
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
                            onClick={() => { onViewSizeChange("small"); setMenuOpen(false); }}
                        >
                            小
                        </button>
                        <button
                            className={"card-menu-item" + (viewSize === "medium" ? " active" : "")}
                            onClick={() => { onViewSizeChange("medium"); setMenuOpen(false); }}
                        >
                            中
                        </button>
                        <button
                            className={"card-menu-item" + (viewSize === "large" ? " active" : "")}
                            onClick={() => { onViewSizeChange("large"); setMenuOpen(false); }}
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
    );

}

export default CardHeader;