import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { audio } from "./game/audio";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary
      gameName="Subway Stuffing"
      accent="#f0c14a"
      saveKeys={["hellmetro-save-v1"]}
      onCrash={() => audio.stopMusic()}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>
);
