import { useEffect, useState } from "react";
import { getFileIcon } from "../api/card";

function FileIcon({ path }: { path: string }) {
    const [icon, setIcon] = useState("");

    useEffect(() => {
        getFileIcon( path )
            .then(setIcon)
            .catch(() => setIcon(""));
    }, [path]);

    return <img className="file-preview" src={icon || undefined} alt="" draggable={false} />;
}

export default FileIcon;