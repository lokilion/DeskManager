import { useState } from "react";
import { createCard, openCard } from "../api/card";

import "./MainView.css";
import { useMainCards } from "../hooks/useMainCards";

function MainView(){
    //当事件发出后执行useCards中的reload，自动更新cards
    const { cards } = useMainCards();
    const [cardName, setCardName] = useState("");

    //create_new_card
    async function handleCreate() {
        await createCard(cardName || "新卡片");
        setCardName("");
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
                <li
                    onDoubleClick={()=>{
                        openCard(card.cardLabel).catch((reson)=>{
                            console.error("[main]打开窗口失败", reson);
                        });
                    }}
                    key={card.cardLabel}
                >
                    {card.cardName}({card.fileVec.length} 个文件）
                </li>
                ))
            }
        </ul>
        </main>
    )
}

export default MainView;