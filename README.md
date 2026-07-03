# Market Mentor

**Live app: https://market-mentor.pages.dev** — invite code `MENTOR-FRIENDS`

A stock analysis, scanning and learning platform for beginners — inspired by Yahoo Finance, but with transparent technical scanning, plain-English explanations, pattern teaching, and actionable alerts.

**Educational and analytical software. Not financial advice.** All signals are probabilistic observations about historical price behavior.

## Running it

```bash
npm install
npm run dev      # http://localhost:5199
npm run build    # production build in dist/
```

First launch: create an account with invite code **MENTOR-FRIENDS**. Each user then gets a personal invite code (Settings → Friends & sharing) to onboard friends. Accounts and all user data (watchlists, alert rules, history, preferences) are stored per-user in localStorage; the data shapes mirror a real backend so swapping in an API later is mechanical.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Index summaries, market breadth, top scanner hits, "why this stock is interesting" pattern cards, recent alerts, momentum leaders |
| Screener | S&P 500 + Russell 2000 universe; filters for sector, market cap, P/E, price, volume, RSI, MACD state, MA alignment, relative volume, patterns, setup score; sortable table; saved screens |
| Stock detail | Candles/line chart with 1D–5Y timeframes, volume, SMA 20/50/100/150/200, EMA 20/50, Bollinger, VWAP overlays; RSI/MACD/stochastic panels; plain-English trend interpretation and risk notes; transparent setup-score checklist; pattern annotation on the chart; fundamentals with tooltips |
| Pattern Explorer | Teaches 10 chart patterns and 8 candlestick patterns (what, psychology, detection rules, false signals) + live detections across the universe |
| Learn | Indicator deep-dives and an 19-term glossary, each with beginner-mode wording and mini examples |
| Watchlists | Multiple lists, live-ticking quotes, sparklines |
| Alerts | Rule builder (MA crosses, MACD cross, unusual volume, RSI recovery, breakout, pattern confidence), history with plain-English explanation drawers, notification preferences |
| Settings | Theme, beginner mode, push setup, data-provider info, invite codes |

## Architecture

- `src/lib/data/` — **provider abstraction**: the app only talks to the `MarketDataProvider` interface. The bundled `mockProvider` generates deterministic, regime-switching OHLCV so charts look real and contain genuine setups. Every payload carries a freshness label (`realtime` / `near-realtime` / `delayed` / `simulated`) that the UI always displays. Swap vendors by implementing the interface and changing one line in `main.tsx`.
- `src/lib/indicators/` — pure-function indicator engine (SMA, EMA, RSI, MACD, Bollinger, VWAP, stochastic, ATR, relative volume, regression slope).
- `src/lib/patterns/` — chart-pattern detector (pivot-based geometry rules, confidence from fit quality) and candlestick detector. No black boxes: detection rules are documented in-app.
- `src/lib/scanner/` — weighted scoring engine. Every condition has a fixed weight and a plain-English detail string; the score is the sum of met weights. Results always include the full condition breakdown.
- `src/lib/alerts/` — rule evaluation engine. Runs client-side against the simulated feed in the prototype; designed to move server-side unchanged.
- `src/content/` — structured education layer (glossary, indicator docs, pattern docs).
- `src/state/` — per-user store (accounts, watchlists, rules, settings) persisted to localStorage.

## PWA & notifications

- Installable: manifest + icons + service worker with app-shell caching.
- The service worker has a **real Web Push handler** — a backend can start sending pushes to it without any app changes (subscribe via `pushManager.subscribe` with a VAPID key in `store.requestPush`, noted in code).
- In the prototype, alert delivery posts to the service worker (`SIMULATED_PUSH`) so notifications behave exactly like production pushes, including click-to-open-stock.
