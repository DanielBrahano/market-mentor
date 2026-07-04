import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./state/store";
import { setProvider } from "./lib/data/provider";
import { mockProvider } from "./lib/data/mockProvider";
import { liveProvider, WORKER_BASE } from "./lib/data/liveProvider";
import { getDataSourcePreference, markLiveFallback } from "./lib/data/select";
import "./styles/global.css";

/**
 * Bootstrap: pick the market-data provider before rendering.
 * Live (real quotes incl. pre/post market, via the data relay) is the default;
 * if the relay is unreachable we fall back to the simulated full-market feed
 * for this session and say so in Settings.
 */
async function healthCheck(timeoutMs: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${WORKER_BASE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function boot() {
  if (getDataSourcePreference() === "live") {
    // Slow mobile networks need patience: generous timeout plus one retry.
    const ok = (await healthCheck(8000)) || (await healthCheck(8000));
    if (ok) {
      setProvider(liveProvider);
    } else {
      markLiveFallback();
      setProvider(mockProvider);
    }
  } else {
    setProvider(mockProvider);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

void boot();

// PWA: register the service worker (app-shell cache for offline/installed use).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* dev mode without SW is fine */ });
  });
}
