import { useEffect, useRef } from "react";
import { onCardUpdated } from "../api/card";

export function useCardUpdate(handler: ()=>void){
    let handlerRef = useRef(handler);
    useEffect(()=>{
        handlerRef.current = handler;
    },[handler])

    useEffect(()=>{
        let unlisten: (()=>void) | undefined;
        let cancel = false;
        onCardUpdated(() => handlerRef.current())
        .then((fn) => {
            if(cancel){
                fn();
            }else{
                unlisten = fn;
            }
        });

        //如果Pormise没有即时返回，且组件被卸载
        //取消订阅
        return () => {
            cancel = true;
            unlisten?.();
        };
    },[])

}