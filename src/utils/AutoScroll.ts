export function autoScroll(list: HTMLElement | null, y: number) {
    console.log("{}",y);
    if(!list){return;}
    const r = list.getBoundingClientRect();
    const EDGE = 24;
    if (y < r.top + EDGE) list.scrollTop -= 10;
    else if (y > r.bottom - EDGE) list.scrollTop += 10;
}