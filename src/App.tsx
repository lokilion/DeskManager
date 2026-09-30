import "./App.css";

import MainView from "./views/MainView";
import CardView from "./views/CardView";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

function App() {
  const cardLabel = getCurrentWebviewWindow().label;

  if (cardLabel === "main") {
    return <MainView />;
  } else {
    return <CardView cardLabel={cardLabel} />;
  }
}

export default App;
