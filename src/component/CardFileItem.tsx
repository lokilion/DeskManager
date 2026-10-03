import { convertFileSrc } from "@tauri-apps/api/core";
import { DropLine, FileItem, ViewSize } from "../type";
import FileIcon from "./FileIcon";
import { openFile, reorderCardFiles } from "../api/card";
import { useRef, useState } from "react";
import { buildOrder, computeDropIndex } from "../utils/ReorderDrag";
import { autoScroll } from "../utils/AutoScroll";

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
    // 存储左上右下对角两点的坐标
    const [marquee, setMarquee] = useState<
            { x1: number; y1: number; x2: number; y2: number } | null
        >(null);
    // 拖动排序的指示线
    const [dropLine, setDropLine] = useState<DropLine|null>(null);
    // 拖动排序的插入下标
    const pendingDropIndex = useRef<number | null>(null)

    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        path: string;
        active: boolean;
        paths: Set<string>;
    } | null>(null);
    //use this to render
    const [draggingPaths, setDraggingPaths] = useState<Set<string>>(() => new Set());
    
    if(files === undefined){ return; }
    const innerFiles = files;
    
    function isImage(name: string) {
        return /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(name);
    }

    function handlePointerDown(e: React.PointerEvent<HTMLUListElement>) {
        if (e.button !== 0) return; // 只响应左键
        // 点在条目上 → 记录当前item和鼠标状态
        const itemEl = (e.target as HTMLElement).closest<HTMLElement>(".file-item");
        if (itemEl?.dataset.filePath) {
            dragRef.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                path: itemEl.dataset.filePath,
                active: false,
                paths: new Set(),
            }
            return;
        }

        // 指针捕获：把后续的 move/up 都锁定到这个元素上。
        // 不捕获的话，鼠标一旦移出列表（比如拖到卡片标题栏上），
        // 我们就收不到 pointerup，框会永远留在屏幕上。
        listRef.current?.setPointerCapture(e.pointerId);
        setMarquee({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    }

    function handlePointerMove(e: React.PointerEvent<HTMLUListElement>) {
        if (marquee){ 
            setMarquee((prev) => (prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null));
            return;
        }
        //图标拖动排序
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        if(!drag.active){
            const moved = Math.hypot(e.clientX-drag.startX, e.clientY-drag.startY);
            if(moved<=DRAG_THRESHOLD*1.2) return;
            //确定是拖动
            drag.active = true;
            //捕捉鼠标
            e.currentTarget.setPointerCapture(e.pointerId);
            //按在选择项目中则拖动所有项目
            if(selectedSet.has(drag.path)){
                drag.paths = new Set(selectedSet);
            }else{
                onItemClick(drag.path, {additive: false, range:false});
                drag.paths = new Set([drag.path])
            };
            setDraggingPaths(drag.paths);
        }
        //已经开始拖动
        else{
            const drop = computeDropIndex(listRef.current, e.clientX, e.clientY);
            setDropLine(drop.line);
            pendingDropIndex.current = drop.index;
            autoScroll(listRef.current, e.clientY);
        }
    }

    function handlePointerUp(e: React.PointerEvent<HTMLUListElement>) {
        const drag = dragRef.current;
        if(drag && drag.pointerId == e.pointerId){
            dragRef.current = null;
            if(drag.active){
                //释放鼠标
                if(e.currentTarget.hasPointerCapture(e.pointerId)){e.currentTarget.releasePointerCapture(e.pointerId);}
                //清空渲染用state
                setDraggingPaths(new Set());
                //上传拖动结果
                commitOrder(drag);
                //释放dropline
                setDropLine(null);
            }
            return;
        }

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
            if (intersects) {
                //获取该元素上自定义的“data-file-path”
                const path = el.dataset.filePath;
                if (path) hit.add(path);
            }
        });
        onMarqueeSelect(hit, { additive });
    }

    function commitOrder(drag: NonNullable<typeof dragRef.current>) {
        const list = listRef.current;
        if(list && pendingDropIndex.current){
            const order = buildOrder(innerFiles, drag.paths, pendingDropIndex.current);
            if (order.every((f, i) => f.path === innerFiles[i].path
            && order.length === innerFiles.length)){ return; }
            reorderCardFiles(cardLabel, order);
        }
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
                        className={"file-item"
                            + (selectedSet.has(file.path) ? " selected" : "")
                            + (draggingPaths.has(file.path) ? " dragging" : "")
                        }
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
            {dropLine && (
                <div
                    className="drop-line"
                    style={{
                        left: dropLine.line_x, 
                        top: dropLine.line_y, 
                        height: dropLine.height
                    }}
                />
            )}
        </>
    );
}

export default CardFileItem;