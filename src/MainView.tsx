import { useEffect, useState } from "react";
import { CardData } from "./type";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function MainView(){
    const [cards, setCards] = useState<CardData[]>([])
    const [cardName, setCardName] = useState("");

    async function get_cards() {
        const list = await invoke<CardData[]>("list_cards");
        setCards(list);
    }
    useEffect(() => {
        get_cards();
    }, []);

    useEffect(()=>{
        let unlisten: (()=>void) | undefined;

        listen("card-update", () => {
            get_cards();
        })
        .then((fn) => {
            unlisten = fn;
        });

        return () => {
            unlisten?.();
        };
    },[])

    //create_new_card
    async function handleCreate() {
        await invoke("create_new_card", {cardName: cardName || "新卡片"});
        setCardName("");
        await get_cards();
    }

    return(
        <main className="container">
        <h1 data-tauri-drag-region>卡片管理器</h1>

        <div className="row">
            <input
            value={cardName}
            onChange={(e) => setCardName(e.currentTarget.value)}
            placeholder="输入卡片名称"
            />
            <button onClick={handleCreate}>新建卡片</button>
        </div>

        <ul>
            {cards.map((card) => (
                <li key={card.card_label}>
                    {card.card_name}({card.file_vec.length} 个文件）
                </li>
                ))
            }
        </ul>
        </main>

    )
}

export default MainView;