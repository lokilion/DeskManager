import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function FileIcon({ path }: { path: string }) {
    const [icon, setIcon] = useState("");

    useEffect(() => {
        invoke<string>("get_file_icon", { path: path })
            .then(setIcon)
            .catch(() => setIcon(""));
    }, [path]);

    return <img className="file-preview" src={icon} alt="" draggable={false} />;
}

export default FileIcon;