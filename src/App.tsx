import "./App.css";

import MainView from "./MainView";
import CardView from "./CardView";
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
