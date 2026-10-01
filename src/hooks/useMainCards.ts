import { useCallback, useEffect, useState } from "react"
import { CardData } from "../type";
import { listCards } from "../api/card";
import { useCardUpdate } from "./useCardUpdate";

export function useMainCards(){
    const [cards, setCards] = useState<CardData[]>([]);

    const reload = useCallback(async () => {
        setCards(await listCards());
    },[]);

    //初次渲染结束后执行reload
    useEffect(()=>{
        reload();
    },[reload])

    //加入事件监听
    useCardUpdate(reload);

    return {cards, reload};
}