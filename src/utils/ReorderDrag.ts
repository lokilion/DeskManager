import { FileItem, DropLine } from "../type";

export function buildOrder(
    fileList: FileItem[], 
    movedPaths: Set<string>, 
    dropIndex: number 
): FileItem[]{
    const moved = fileList.filter((f)=>movedPaths.has(f.path));

    const removedBefore = fileList
        .slice(0, dropIndex)
        .filter((f)=>movedPaths.has(f.path))
        .length;
    const insertAt = dropIndex - removedBefore;

    const rest = fileList.filter((f)=>!movedPaths.has(f.path));
    const next = [
        ...rest.slice(0, insertAt),
        ...moved, 
        ...rest.slice(insertAt)
    ];
    return next;
}

export function computeDropIndex(
    //li element
    list:HTMLElement|null, 
    x: number, 
    y: number
): {index: number; line: DropLine|null}{
    if(!list){return {index: 0, line: null};}
    const fileList = Array.from(list.querySelectorAll<HTMLElement>(".file-item"));

    const rects = fileList.map((el) => el.getBoundingClientRect());
    let index = -1;
    // ① 指针正好落在某一项里：左半边 → 插它前面；右半边 → 插它后面
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (x >= r.left && x <= r.right 
            && y >= r.top && y <= r.bottom) {
            index = x < r.left + r.width / 2 ? i : i + 1;
            break
        }
    }
    if(index<0){
        // ② 落在行间空隙 / 列表尾部空白：找最近的一项，按垂直中线定前后
        let nearest = 0;
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            const dx = x - (r.left + r.width / 2);
            const dy = y - (r.top + r.height / 2);
            const d = dx * dx + dy * dy;
            if (d < best) { best = d; nearest = i; }
        }
        const r = rects[nearest];
        index = y > r.top + r.height / 2 ? nearest + 1 : nearest;
    }
    const lineAnchor = rects[Math.min(index, rects.length-1)];
    //仅当插入到最后一项时候才会渲染右边的竖线
    const line_x = index >= rects.length ? lineAnchor.right + 2 : lineAnchor.left - 2;
    return { index, line: { line_x, line_y: lineAnchor.top, height: lineAnchor.height } };
}