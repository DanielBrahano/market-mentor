import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./state/store";
import { setProvider } from "./lib/data/provider";
import { mockProvider } from "./lib/data/mockProvider";
import "./styles/global.css";

// Register the active market-data provider. Swapping to a real vendor later
// is a one-line change here (plus the new provider implementation).
setProvider(mockProvider);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// PWA: register the service worker (app-shell cache + push handlers).
if ("serviceWorker" in navigator && !location.hostname.includes("stackblitz")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* dev mode without SW is fine */ });
  });
}
