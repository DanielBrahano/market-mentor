# Market Mentor

**Live app: https://market-mentor.pages.dev** — open to everyone, no account needed.

A stock analysis, scanning and learning platform for beginners — inspired by Yahoo Finance, but with transparent technical scanning, plain-English explanations, pattern teaching, and actionable alerts.

**Educational and analytical software. Not financial advice.** All signals are probabilistic observations about historical price behavior.

## Data modes

| Mode | What you get |
|---|---|
| **Live** (default) | Real prices and charts for the **full S&P 500 (~500 real companies)** plus curated small caps, **including pre/post-market** state and prices, near real-time, via the Market Mentor data relay (Cloudflare Worker proxying Yahoo Finance's public chart API). Real index levels (S&P 500, Nasdaq, Russell 2000, Dow). Fundamentals are approximations and labeled as such. |
| **Simulated** | The full ~2,400-stock S&P 500 + Russell 2000 universe with realistic, deterministic generated data — useful for exploring the scanner at full-market breadth. |

Switch in **Settings → Market data**. If the relay is unreachable, the app falls back to simulated data for the session and says so.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5199
npm run build    # production build in dist/
```

Deploy the web app: `npx wrangler pages deploy dist --project-name market-mentor --branch main`
Deploy the data relay: `cd worker && npx wrangler deploy`

## What's inside

- **Dashboard** — real index summaries, market breadth, top scanner hits, "why this stock is interesting" pattern cards, recent alerts, momentum leaders
- **Screener** — filters for sector, market cap, P/E, price, volume, RSI, MACD state, MA alignment, relative volume, patterns, setup score; sortable, paginated; saved screens
- **Stock detail** — candles/line, 1D–5Y, volume, SMA 20/50/100/150/200, EMA 20/50, Bollinger, VWAP; RSI/MACD/stochastic panels; plain-English trend interpretation + risk notes; transparent setup-score checklist; pattern annotation on the chart; **pre/post-market price line** when the market is in extended hours
- **Pattern Explorer** — **top companies per pattern** leaderboards (ranked by detection confidence) plus teaching guides for 10 chart patterns and 8 candlestick patterns
- **Learn** — indicator deep-dives and a plain-English glossary
- **Watchlists & Alerts** — watchlists with live-polling quotes; alert rules (MA crosses, MACD cross, unusual volume, RSI recovery, breakout, pattern confidence) with plain-English explanation drawers and per-day dedupe

## Architecture

- `src/lib/data/` — provider abstraction: the app talks only to the `MarketDataProvider` interface. `liveProvider` (data relay) and `mockProvider` (deterministic simulation, LRU-cached generation) are interchangeable; a bootstrap health check picks one per session. Every payload carries an honest freshness label.
- `worker/` — the data relay (Cloudflare Worker): `/quotes` (batch, incl. market state + extended-hours price derived from trading-period metadata), `/candles`, `/intraday` (5-min bars incl. pre/post), `/indexes`; edge-cached (quotes 30s, candles 15min).
- `src/lib/indicators|patterns|scanner/` — pure indicator engine; pivot-geometry pattern detection with confidence scores; transparent weighted scoring (no black box — every result carries its full condition breakdown). The scanner runs group-concurrent fetches with progress events and breadth accumulation in a single pass.
- `src/state/` — no accounts: watchlists, alert rules, history and settings persist in the browser's localStorage.
- PWA: installable, offline app-shell caching; the service worker also ships a production-ready Web Push handler for when server-side alerting is added.
