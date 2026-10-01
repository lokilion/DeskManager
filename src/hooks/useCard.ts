import { useCallback, useEffect, useState } from "react"
import { CardData } from "../type"
import { getCard } from "../api/card";
import { useCardUpdate } from "./useCardUpdate";

export function useCard(cardLabel: string){
    const [card, setCarrd] = useState<CardData>();
    const reload = useCallback(async ()=>{
        setCarrd(await getCard(cardLabel));
    },[cardLabel]);

    useEffect(()=>{
        reload()
    },[reload]);

    useCardUpdate(reload);

    return {card, reload};
}