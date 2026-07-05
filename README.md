# Market Mentor

**Live app: https://market-mentor.pages.dev** — open to everyone, no account needed.

A stock analysis, scanning and learning platform for beginners — inspired by Yahoo Finance, but with transparent technical scanning, plain-English explanations, pattern teaching, and actionable alerts.

**Educational and analytical software. Not financial advice.** All signals are probabilistic observations about historical price behavior.

## What is Market Mentor?

Market Mentor shows **real market prices** (near real-time, including pre-market and after-hours), scans ~500 S&P 500 stocks for possible bullish setups, and explains everything in plain English so you don't need to be a trader to understand what you're looking at. Its whole personality: **no black boxes** — every score, signal and pattern comes with the exact reasons behind it, and every technical term has a hover-? explainer.

### The pages, in plain English

| Page | What it's for |
|---|---|
| **Dashboard** | The morning glance: real index levels (click any index card for a plain-English explainer of what it tracks and how to read it), market session state (pre-market / open / after hours / closed), market breadth, today's top scanner hits, detected patterns, top gainers & losers, recent alerts |
| **Screener** | The research table: filter every scanned stock by sector, size, P/E, price, volume, RSI, MACD, trend alignment or setup score — then sort, paginate and save your screens |
| **Stock page** (click any ticker) | Professional chart with indicators, a "what the chart is saying" plain-English readout, risk notes, the transparent setup-score checklist, pattern annotations, and pre/post-market prices |
| **Pattern Explorer** | "Top stocks by pattern" — which companies show a Double Bottom, Bull Flag, Cup & Handle etc. *right now*, ranked by detection confidence — plus guides teaching every pattern |
| **Learn** | Indicator deep-dives and a beginner-friendly glossary |
| **Watchlists** | Your personal lists with live-updating quotes (incl. extended-hours prices), saved in your browser |
| **Alerts** | Rules like "tell me when a watchlist stock crosses its 200-day average" — every alert explains what happened and why it might matter |

### How to use it (the 3-step habit)

1. **Start on the Dashboard** — is the market broadly healthy today? Check the session chip, breadth and the index cards.
2. **Find candidates** — via top scanner hits, the Screener, or Pattern Explorer's leaderboards.
3. **Click into the stock** — read the plain-English chart interpretation and risk notes, open the score checklist to see *exactly why* it scored what it did, and add it to a watchlist if it's worth tracking. Then do your own research before any real-money decision.

### On your phone

Open the site in your phone's browser and use **Add to Home Screen** (Share menu on iOS, ⋮ menu on Android) — it installs as an app with the same live data.

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
