import { convertFileSrc } from "@tauri-apps/api/core";
import { FileItem, ViewSize } from "../type";
import FileIcon from "./FileIcon";
import { openFile } from "../api/card";
import { useRef, useState } from "react";

const DRAG_THRESHOLD = 4;

// selected icon paths
// [onItemClick] / [onMarqueeSelect]
// when a file item been clicked, tarck the file's path and the key modifyer we press when clicking
type Props = {
    cardLabel: string;
    files: FileItem[] | undefined;
    viewSize: ViewSize;
    selectedSet: Set<string>;
    onItemClick: (path: string, modifiers: { additive: boolean; range: boolean }) => void;
    onMarqueeSelect: (paths: Set<string>, modifiers: { additive: boolean }) => void;
};
function CardFileItem({
    cardLabel,
    files, 
    viewSize, 
    selectedSet,
    onItemClick, 
    onMarqueeSelect
}: Props ){
    const listRef = useRef<HTMLUListElement>(null);
    // 拖框的起止点，用「视口坐标」（clientX/clientY）
    const [marquee, setMarquee] = useState<
            { x1: number; y1: number; x2: number; y2: number } | null
        >(null);

    if(files === undefined){ return; }

    function isImage(name: string) {
        return /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(name);
    }

    function handlePointerDown(e: React.PointerEvent<HTMLUListElement>) {
        if (e.button !== 0) return; // 只响应左键
        if ((e.target as HTMLElement).closest(".file-item")) return;    // 点在条目上 → 交给条目自己

        // 指针捕获：把后续的 move/up 都锁定到这个元素上。
        // 不捕获的话，鼠标一旦移出列表（比如拖到卡片标题栏上），
        // 我们就收不到 pointerup，框会永远留在屏幕上。
        listRef.current?.setPointerCapture(e.pointerId);
        setMarquee({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    }

    function handlePointerMove(e: React.PointerEvent<HTMLUListElement>) {
        if (!marquee) return;
        setMarquee((prev) => (prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null));
    }

    function handlePointerUp(e: React.PointerEvent<HTMLUListElement>) {
        if (!marquee) return;
        listRef.current?.releasePointerCapture(e.pointerId);

        // 归一化成左上角 + 宽高（用户可能往左上方向拖）
        const rect = {
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            right: Math.max(marquee.x1, marquee.x2),
            bottom: Math.max(marquee.y1, marquee.y2),
        };
        const additive = e.ctrlKey || e.metaKey;
        setMarquee(null);

        // 几乎没拖动 → 当成"单击空白"，只清空选择
        if (rect.right - rect.left < DRAG_THRESHOLD && 
            rect.bottom - rect.top < DRAG_THRESHOLD) {
            onMarqueeSelect(new Set(), { additive: false });
            return;
        }

        // 矩形碰撞：谁和框有交集就选中谁。
        // 使用getBoundingClientRect() 返回视口(client 坐标)坐标，
        // 不需要扣掉列表的 padding 和滚动量
        const hit = new Set<string>();
        //获取className为file-item的元素
        listRef.current?.querySelectorAll<HTMLElement>(".file-item").forEach((el) => {
            const item = el.getBoundingClientRect();
            const intersects =
                rect.left < item.right &&
                rect.right > item.left &&
                rect.top < item.bottom &&
                rect.bottom > item.top;
            console.log("{}",intersects);
            if (intersects) {
                //获取该元素上自定义的“data-file-path”
                const path = el.dataset.filePath;
                if (path) hit.add(path);
            }
        });
        onMarqueeSelect(hit, { additive });
    }

    return(
        <>
            <ul
                ref = {listRef} 
                className={"card-files size-" + viewSize}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {files.map((file) => (
                    <li
                        data-file-path={file.path}
                        key={file.path}
                        className={"file-item"+ (selectedSet.has(file.path) ? " selected" : "")}
                        onClick={(e)=>onItemClick(file.path, {
                            additive: e.ctrlKey || e.metaKey,
                            range: e.shiftKey,
                        })}
                        onDoubleClick={() => {openFile(cardLabel, file.path);}}
                    >
                        {/* 图标逻辑 */}
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
                        {/* 图标名 */}
                        <div className="file-name" title={file.name}>{file.name}</div>
                    </li>
                ))}
            </ul>
            {marquee && (
                <div 
                    className="marquee"  
                    style={{
                        left: Math.min(marquee.x1, marquee.x2),
                        top: Math.min(marquee.y1, marquee.y2),
                        width: Math.abs(marquee.x2 - marquee.x1),
                        height: Math.abs(marquee.y2 - marquee.y1),
                    }}
                />
            )}
        </>
    )
}

export default CardFileItem;