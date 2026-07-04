/**
 * Market Mentor data relay.
 *
 * Proxies Yahoo Finance's public v8 chart API (no auth/crumb required) and
 * normalizes it for the app, with edge caching so friends sharing the app
 * don't hammer the upstream. Pre/post-market prices come from includePrePost
 * intraday bars + the exchange's trading-period metadata.
 *
 * Routes:
 *   GET /health
 *   GET /quotes?symbols=AAPL,MSFT,...   (max 25 — Workers subrequest limit)
 *   GET /candles?symbol=AAPL&range=2y&interval=1d
 *   GET /intraday?symbol=AAPL           (1d of 5m bars incl. pre/post)
 *   GET /indexes                        (S&P 500, Nasdaq, Russell 2000, Dow)
 */

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketMentor/1.0" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ALLOWED_RANGES = new Set(["5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"]);
const ALLOWED_INTERVALS = new Set(["1d", "1wk", "5m", "15m", "30m", "60m"]);
const SYM_RE = /^[\^]?[A-Z0-9.\-]{1,10}$/;

function json(data, ttl = 30) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttl}`,
      ...CORS,
    },
  });
}

function err(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function fetchChart(symbol, params) {
  const url = `${YAHOO}${encodeURIComponent(symbol)}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: UA, cf: { cacheTtl: 25, cacheEverything: true } });
  if (!res.ok) throw new Error(`upstream ${res.status} for ${symbol}`);
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(body?.chart?.error?.description || `no data for ${symbol}`);
  return result;
}

/** Derive market state from the exchange's trading periods (unix seconds). */
function marketState(meta, nowSec) {
  const p = meta.currentTradingPeriod;
  if (!p) return "CLOSED";
  if (nowSec >= p.regular.start && nowSec < p.regular.end) return "REGULAR";
  if (nowSec >= p.pre.start && nowSec < p.regular.start) return "PRE";
  if (nowSec >= p.regular.end && nowSec < p.post.end) return "POST";
  return "CLOSED";
}

/** Build a normalized quote (with extended-hours info) from a 1d/5m chart. */
function buildQuote(result, nowSec) {
  const meta = result.meta;
  const state = marketState(meta, nowSec);
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;

  // Latest extended-hours print: last non-null close outside regular hours.
  let extendedPrice = null;
  if (state === "PRE" || state === "POST") {
    const ts = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const reg = meta.currentTradingPeriod.regular;
    for (let i = ts.length - 1; i >= 0; i--) {
      const inRegular = ts[i] >= reg.start && ts[i] < reg.end;
      if (!inRegular && closes[i] != null) { extendedPrice = closes[i]; break; }
    }
  }

  const quote = {
    symbol: meta.symbol,
    price,
    prevClose,
    change: round2(price - prevClose),
    changePct: prevClose ? round2(((price - prevClose) / prevClose) * 100) : 0,
    dayHigh: meta.regularMarketDayHigh ?? price,
    dayLow: meta.regularMarketDayLow ?? price,
    volume: meta.regularMarketVolume ?? 0,
    marketState: state,
    updatedAt: Date.now(),
  };
  if (extendedPrice != null) {
    quote.extendedPrice = round2(extendedPrice);
    quote.extendedChangePct = round2(((extendedPrice - price) / price) * 100);
  }
  return quote;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function normalizeCandles(result) {
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.open?.[i] == null) continue;
    out.push({
      t: ts[i] * 1000,
      o: round2(q.open[i]),
      h: round2(q.high[i]),
      l: round2(q.low[i]),
      c: round2(q.close[i]),
      v: q.volume?.[i] ?? 0,
    });
  }
  return out;
}

/** Edge cache wrapper: serves from cache, else computes and stores. */
async function cached(request, ttl, compute) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set("X-Cache", "HIT");
    return res;
  }
  const res = await compute();
  if (res.ok) {
    const store = res.clone();
    const headers = new Headers(store.headers);
    headers.set("Cache-Control", `public, max-age=${ttl}`);
    await cache.put(key, new Response(store.body, { status: store.status, headers }));
  }
  return res;
}

const INDEXES = [
  { id: "spx", name: "S&P 500", symbol: "^GSPC" },
  { id: "ndx", name: "Nasdaq", symbol: "^IXIC" },
  { id: "rut", name: "Russell 2000", symbol: "^RUT" },
  { id: "dji", name: "Dow Jones", symbol: "^DJI" },
];

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return err("GET only", 405);

    const url = new URL(request.url);
    const nowSec = Math.floor(Date.now() / 1000);

    try {
      switch (url.pathname) {
        case "/health":
          return json({ ok: true, at: Date.now() });

        case "/quotes": {
          const symbols = (url.searchParams.get("symbols") || "")
            .split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYM_RE.test(s));
          if (symbols.length === 0) return err("symbols required");
          if (symbols.length > 25) return err("max 25 symbols per request");
          return cached(request, 30, async () => {
            const settled = await Promise.allSettled(
              symbols.map((s) => fetchChart(s, { range: "1d", interval: "5m", includePrePost: "true" }))
            );
            const quotes = [];
            settled.forEach((r, i) => {
              if (r.status === "fulfilled") quotes.push(buildQuote(r.value, nowSec));
              else quotes.push({ symbol: symbols[i], error: String(r.reason?.message || r.reason) });
            });
            return json({ quotes }, 30);
          });
        }

        case "/candles": {
          const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
          const range = url.searchParams.get("range") || "2y";
          const interval = url.searchParams.get("interval") || "1d";
          if (!SYM_RE.test(symbol)) return err("invalid symbol");
          if (!ALLOWED_RANGES.has(range) || !ALLOWED_INTERVALS.has(interval)) return err("invalid range/interval");
          return cached(request, 900, async () => {
            const result = await fetchChart(symbol, { range, interval });
            return json({ symbol, candles: normalizeCandles(result) }, 900);
          });
        }

        case "/intraday": {
          const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
          if (!SYM_RE.test(symbol)) return err("invalid symbol");
          return cached(request, 60, async () => {
            const result = await fetchChart(symbol, { range: "1d", interval: "5m", includePrePost: "true" });
            return json({
              symbol,
              quote: buildQuote(result, nowSec),
              candles: normalizeCandles(result),
              regular: result.meta.currentTradingPeriod?.regular ?? null,
            }, 60);
          });
        }

        case "/indexes": {
          return cached(request, 60, async () => {
            const settled = await Promise.allSettled(
              INDEXES.map((ix) => fetchChart(ix.symbol, { range: "1mo", interval: "1d" }))
            );
            const indexes = [];
            settled.forEach((r, i) => {
              if (r.status !== "fulfilled") return;
              const meta = r.value.meta;
              const closes = (r.value.indicators?.quote?.[0]?.close || []).filter((x) => x != null);
              const price = meta.regularMarketPrice;
              const prev = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
              indexes.push({
                id: INDEXES[i].id,
                name: INDEXES[i].name,
                value: round2(price),
                change: round2(price - prev),
                changePct: round2(((price - prev) / prev) * 100),
                spark: closes.map(round2),
              });
            });
            return json({ indexes }, 60);
          });
        }

        default:
          return err("not found", 404);
      }
    } catch (e) {
      return err(String(e?.message || e), 502);
    }
  },
};
