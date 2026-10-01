import { convertFileSrc } from "@tauri-apps/api/core";
import { FileItem, ViewSize } from "../type";
import FileIcon from "./FileIcon";

//files we need to rendeer;
//icon size;
type Props = {
    files: FileItem[] | undefined;
    viewSize: ViewSize;
};
function CardFileItem( {files, viewSize}: Props ){
    if(files === undefined){ return; }
    
    function isImage(name: string) {
        return /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(name);
    }

    return(
        <ul className={"card-files size-" + viewSize}>
            {files.map((file) => (
                <li
                    key={file.path}
                    className="file-item"
                >
                    {isImage(file.name) ? (
                        <img
                            className="file-preview"
                            src={convertFileSrc(file.path)}
                            alt={file.name}
                            draggable={false}
                        />
                    ) : (
                        <FileIcon path={file.path} />
                    )}
                    <div className="file-name" title={file.name}>{file.name}</div>
                </li>
            ))}
        </ul>
    )
}

export default CardFileItem;