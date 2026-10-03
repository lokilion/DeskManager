import { FileItem } from "../type";

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
    list:HTMLElement, 
    x: number, 
    y: number
): number{
    if(!list){return 0;}
    const fileList = Array.from(list.querySelectorAll<HTMLElement>(".file-item"));

    const rects = fileList.map((el) => el.getBoundingClientRect());
        // ① 指针正好落在某一项里：左半边 → 插它前面；右半边 → 插它后面
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            return x < r.left + r.width / 2 ? i : i + 1;
        }
    }

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
    return y > r.top + r.height / 2 ? nearest + 1 : nearest;
}