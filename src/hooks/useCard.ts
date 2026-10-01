import { useCallback, useEffect, useState } from "react"
import { CardData } from "../type"
import { getCard } from "../api/card";
import { useCardUpdate } from "./useCardUpdate";

export function useCard(cardLabel: string){
    const [card, setCard] = useState<CardData>();
    const reload = useCallback(async ()=>{
        setCard(await getCard(cardLabel));
    },[cardLabel]);

    useEffect(()=>{
        reload()
    },[reload]);

    useCardUpdate(reload);

    return {card, reload};
}