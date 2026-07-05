import type { Candle, CompanyInfo, IndexSummary, MarketState, Quote, Timeframe } from "../types";
import { hashStr, mulberry32 } from "../utils";
import { CORE_SCAN_SYMBOLS, REAL_UNIVERSE, findEntry } from "./universe";
import type { MarketDataProvider } from "./provider";

/**
 * Live market data provider, backed by the Market Mentor data relay
 * (Cloudflare Worker proxying Yahoo Finance's public chart API).
 *
 * - Real prices and candles, including pre/post-market state and prints.
 * - Universe: the curated real companies only (synthetic fill excluded).
 * - Fundamentals are approximations derived from curated metadata + the real
 *   price (the free chart API exposes no fundamentals) — labeled in the UI.
 */

export const WORKER_BASE = "https://market-mentor-data.daniel431994.workers.dev";

/** App symbols use dots (BRK.B); Yahoo uses dashes (BRK-B). */
const toYahoo = (s: string) => s.replace(/\./g, "-");
const fromYahoo = (s: string) => s.replace(/-/g, ".");

interface RelayQuote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketState: MarketState;
  extendedPrice?: number;
  extendedChangePct?: number;
  error?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_BASE}${path}`);
  if (!res.ok) throw new Error(`Data relay error ${res.status}`);
  return res.json() as Promise<T>;
}

/** Small TTL + LRU cache. */
class TtlCache<T> {
  private map = new Map<string, { at: number; value: T }>();
  constructor(private ttlMs: number, private max: number) {}
  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) { this.map.delete(key); return undefined; }
    this.map.delete(key); this.map.set(key, hit); // refresh LRU
    return hit.value;
  }
  set(key: string, value: T) {
    this.map.set(key, { at: Date.now(), value });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

const quoteCache = new TtlCache<Quote>(25_000, 600);
const dailyCache = new TtlCache<Candle[]>(15 * 60_000, 160);
const fiveYCache = new TtlCache<Candle[]>(30 * 60_000, 24);
const intradayCache = new TtlCache<Candle[]>(60_000, 40);
const avgVolCache = new Map<string, number>();

function toQuote(rq: RelayQuote): Quote {
  const symbol = fromYahoo(rq.symbol);
  const avgVolume = avgVolCache.get(symbol) ?? rq.volume ?? 0;
  return {
    symbol,
    price: rq.price,
    change: rq.change,
    changePct: rq.changePct,
    dayHigh: rq.dayHigh,
    dayLow: rq.dayLow,
    volume: rq.volume,
    avgVolume,
    updatedAt: Date.now(),
    freshness: "near-realtime",
    marketState: rq.marketState,
    extendedPrice: rq.extendedPrice,
    extendedChangePct: rq.extendedChangePct,
  };
}

async function fetchQuotesChunk(symbols: string[]): Promise<Quote[]> {
  const { quotes } = await getJson<{ quotes: RelayQuote[] }>(
    `/quotes?symbols=${symbols.map(toYahoo).join(",")}`
  );
  const out: Quote[] = [];
  for (const rq of quotes) {
    if (rq.error || rq.price == null) continue;
    const q = toQuote(rq);
    quoteCache.set(q.symbol, q);
    out.push(q);
  }
  return out;
}

async function getQuotesImpl(symbols: string[]): Promise<Quote[]> {
  const misses = symbols.filter((s) => !quoteCache.get(s));
  for (let i = 0; i < misses.length; i += 25) {
    await fetchQuotesChunk(misses.slice(i, i + 25));
  }
  return symbols.map((s) => quoteCache.get(s)).filter((q): q is Quote => !!q);
}

async function getDailyImpl(symbol: string): Promise<Candle[]> {
  const hit = dailyCache.get(symbol);
  if (hit) return hit;
  const { candles } = await getJson<{ candles: Candle[] }>(
    `/candles?symbol=${toYahoo(symbol)}&range=2y&interval=1d`
  );
  if (candles.length === 0) throw new Error(`No history for ${symbol}`);
  dailyCache.set(symbol, candles);
  // Remember the 50-day average volume so quotes can report honest RVOL.
  const tail = candles.slice(-50);
  avgVolCache.set(symbol, Math.round(tail.reduce((a, c) => a + c.v, 0) / tail.length));
  return candles;
}

export const liveProvider: MarketDataProvider = {
  id: "live",
  name: "Live Market Feed",
  freshness: "near-realtime",

  getUniverse: () => REAL_UNIVERSE,

  // Standard scan: full S&P 500 + curated favorites (~520 network fetches).
  // Deep scan: everything incl. ~1,900 real small caps — slower by design.
  getScanUniverse: (deep: boolean) =>
    deep ? REAL_UNIVERSE : REAL_UNIVERSE.filter((e) => e.universe === "sp500" || CORE_SCAN_SYMBOLS.has(e.symbol)),

  async getQuote(symbol) {
    const [q] = await getQuotesImpl([symbol]);
    if (!q) throw new Error(`No quote for ${symbol}`);
    return q;
  },

  async getQuotes(symbols) {
    return getQuotesImpl(symbols);
  },

  async getCandles(symbol, timeframe: Timeframe) {
    if (timeframe === "1D") {
      const hit = intradayCache.get(symbol);
      if (hit) return hit;
      const { candles } = await getJson<{ candles: Candle[] }>(`/intraday?symbol=${toYahoo(symbol)}`);
      intradayCache.set(symbol, candles);
      return candles;
    }
    if (timeframe === "5Y") {
      const hit = fiveYCache.get(symbol);
      if (hit) return hit;
      const { candles } = await getJson<{ candles: Candle[] }>(
        `/candles?symbol=${toYahoo(symbol)}&range=5y&interval=1d`
      );
      fiveYCache.set(symbol, candles);
      return candles;
    }
    const daily = await getDailyImpl(symbol);
    switch (timeframe) {
      case "5D": return daily.slice(-5);
      case "1M": return daily.slice(-22);
      case "3M": return daily.slice(-64);
      case "6M": return daily.slice(-128);
      default: return daily.slice(-252); // 1Y
    }
  },

  getDailyHistory: getDailyImpl,

  async getCompany(symbol) {
    const e = findEntry(symbol);
    if (!e) throw new Error(`Unknown symbol ${symbol}`);
    const price = quoteCache.get(symbol)?.price ?? e.basePrice;
    // Approximate fundamentals: real price scaled against curated metadata.
    const rng = mulberry32(hashStr(symbol + ":fund"));
    const shares = e.baseCap / e.basePrice;
    const eps = e.drift < -0.4 && rng() < 0.4 ? null : Math.round(((e.basePrice / (14 + rng() * 30)) * (0.8 + rng() * 0.4)) * 100) / 100;
    const pe = eps ? Math.round((price / eps) * 10) / 10 : null;
    const info: CompanyInfo = {
      symbol,
      name: e.name,
      sector: e.sector,
      industry: e.industry,
      universe: e.universe,
      marketCap: Math.round(shares * price),
      pe,
      forwardPe: pe ? Math.round(pe * (0.78 + rng() * 0.3) * 10) / 10 : null,
      eps,
      revenue: Math.round(e.baseCap * (0.12 + rng() * 0.5)),
      dividendYield: rng() < 0.45 ? Math.round((0.3 + rng() * 3.2) * 100) / 100 : null,
      beta: Math.round((0.6 + rng() * 1.3) * 100) / 100,
      summary: `${e.summary} (Live mode: price and charts are real; fundamentals shown are approximations.)`,
    };
    return info;
  },

  async getIndexSummaries(): Promise<IndexSummary[]> {
    const { indexes } = await getJson<{ indexes: IndexSummary[] }>("/indexes");
    return indexes;
  },

  subscribeQuotes(symbols, cb) {
    let dead = false;
    const tick = async () => {
      if (dead) return;
      try {
        const qs = await getQuotesImpl(symbols);
        if (!dead) qs.forEach(cb);
      } catch { /* transient network issues: keep polling */ }
    };
    const timer = window.setInterval(tick, 35_000);
    return () => { dead = true; window.clearInterval(timer); };
  },
};
