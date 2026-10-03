import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import CardFileItem from "../component/CardFileItem";
import { ViewSize } from "../type";
import { addFileToCard, removeFileFromCard } from "../api/card";

import "./CardView.css";
import { useCard } from "../hooks/useCard";
import CardHeader from "../component/CardHeader";

function CardView({ cardLabel }: { cardLabel: string }) {

    const { card } = useCard(cardLabel);
    const cardName = card?.cardName ?? "";
    const files = card?.fileVec ?? [];
    const [viewSize, setViewSize] = useState<ViewSize>("medium");
    function onViewSizeChange(size: ViewSize){ setViewSize(size); }

    //选中集
    const [selectedSet, setSelectedSet] = useState<Set<string>>(() => new Set());
    //用于定位上一次非Shift单击的项目位置，初始状态默认是第一项/空
    const [anchor, setAnchor] = useState<string | null>(null);
    useEffect(()=>{
        setAnchor(files[0]?.path ?? null);
    },[files])

    //删除逻辑
    const selectedSetRef = useRef(selectedSet);
    useEffect(() => {
        selectedSetRef.current = selectedSet;
    }, [selectedSet]);
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== "Delete") return;

            const paths = [...selectedSetRef.current];
            if (paths.length === 0) return;

            // 顺手清掉选择集：被移除的条目还留在选中集合里的话，
            // 再按一次 Delete 会去移除一批已经不存在的东西
            setSelectedSet(new Set());
            setAnchor(null);

            removeFileFromCard(cardLabel, paths).catch((reason) => {
                console.error("[card] 移除文件失败:", reason);
            });
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cardLabel]);      // ← 只依赖 cardLabel，所以只订阅一次

    function handleItemClick(
        path: string,
        //是否按住ctrl切换选中状态，是否按住shift范围选中
        {additive, range} : {additive:boolean, range:boolean}
    ){
        setSelectedSet((prev)=>{
            // Shift：从锚点到当前项，整段并入
            if (range && anchor) {
                const from = files.findIndex((f) => f.path === anchor);
                const to = files.findIndex((f) => f.path === path);
                if (from >= 0 && to >= 0) {
                    const [lo, hi] = (from <= to) ? [from, to] : [to, from];
                    const next = new Set<string>();
                    files.slice(lo, hi + 1).forEach((f) => next.add(f.path));
                    return next;
                }
            }
            // Ctrl：切换这一项
            if (additive) {
                const next = new Set(prev);
                if (next.has(path)) {
                    next.delete(path);
                } else {
                    next.add(path);
                }
                return next;
            }

            // 普通单击清空集合并选中自己
            return new Set([path]);
        });
        if (!range) setAnchor(path);
    }

    //ctrl代表“加选”+”状态切换“，这里处理框选逻辑
    function handleMarqueeSelect(hit: Set<string>, { additive }: { additive: boolean }) {
        setSelectedSet((prev) => {
            if(!additive) {return new Set(hit);}

            const next = new Set(prev);
            hit.forEach((p)=>{
                if(next.has(p)){
                    next.delete(p)
                }else{
                    next.add(p)
                }
            })
            return next;
        });
    }

    //文件从外部拖入的逻辑
    useEffect(() => {
        let unlisten: (() => void) | undefined;
        let cancel = false;

        getCurrentWebview()
            .onDragDropEvent((e) => {
                if (e.payload.type === "drop") {
                    addFileToCard(cardLabel, e.payload.paths)
                }
            })
            .then((fn) => { 
                if(cancel){fn();}
                else{unlisten = fn;}
            });

        return () => {
            cancel = true;
            unlisten?.();
        };

    }, [cardLabel]);

    return (
        <main className="card">
            <CardHeader
                cardLabel={cardLabel} 
                cardName={cardName}
                viewSize={viewSize}
                onViewSizeChange={onViewSizeChange}
            />
            <CardFileItem
                cardLabel={cardLabel}
                files={files}
                viewSize={viewSize}
                selectedSet={selectedSet}
                onItemClick={handleItemClick}
                onMarqueeSelect={handleMarqueeSelect}
            />
        </main>
    );
}

export default CardView;