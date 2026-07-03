import type { Candle, CompanyInfo, IndexSummary, Quote, Timeframe } from "../types";
import { hashStr, mulberry32, clamp } from "../utils";
import { UNIVERSE, findEntry, type UniverseEntry } from "./universe";
import type { MarketDataProvider } from "./provider";

/**
 * Deterministic simulated market data provider.
 *
 * Generates ~2.5 years of daily OHLCV per symbol with regime switching
 * (trend / pullback / consolidation) seeded by the ticker, so charts look
 * like real markets, are stable across reloads, and contain genuine
 * technical setups for the scanner and pattern engines to find.
 */

const DAYS = 630; // ~2.5 years of trading days
const DAY_MS = 24 * 3600 * 1000;

interface SymState {
  daily: Candle[];
  intraday: Candle[]; // today's 5-min bars, grown by the tick loop
  quote: Quote;
}

const cache = new Map<string, SymState>();

/** Last trading day at or before today (skip weekends). */
function lastTradingDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.getTime();
}

function genDaily(e: UniverseEntry): Candle[] {
  const rng = mulberry32(hashStr(e.symbol));
  const candles: Candle[] = [];
  const baseVol = e.baseCap > 100e9 ? 3e7 : e.baseCap > 10e9 ? 6e6 : 1.2e6;

  // Work backwards from the base price: start lower/higher so the series ends near basePrice.
  let price = e.basePrice * (0.55 + rng() * 0.5);
  const end = lastTradingDay();
  let t = end - DAYS * DAY_MS * 1.45; // extra room for skipped weekends

  // Regime machine
  let regime: "up" | "down" | "flat" = rng() > 0.5 ? "up" : "flat";
  let regimeLeft = 20 + Math.floor(rng() * 40);
  const dailyVol = 0.012 + rng() * 0.014 + (e.universe === "russell2000" ? 0.008 : 0);

  while (candles.length < DAYS) {
    const d = new Date(t);
    t += DAY_MS;
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    if (--regimeLeft <= 0) {
      const r = rng();
      const bullBias = clamp(0.42 + e.drift * 0.13, 0.15, 0.72);
      regime = r < bullBias ? "up" : r < bullBias + 0.22 ? "flat" : "down";
      regimeLeft = 12 + Math.floor(rng() * 45);
    }

    const driftPct =
      regime === "up" ? 0.0022 + e.drift * 0.0006 :
      regime === "down" ? -0.0028 + e.drift * 0.0004 :
      0.0001;
    const shock = (rng() + rng() + rng() - 1.5) * dailyVol * 1.6; // approx normal
    const ret = driftPct + shock;

    const o = price;
    const c = Math.max(0.5, price * (1 + ret));
    const wick = dailyVol * price * (0.4 + rng() * 1.1);
    const h = Math.max(o, c) + wick * rng();
    const l = Math.min(o, c) - wick * rng();
    const volMult = 1 + Math.abs(ret) * 28 + (rng() - 0.4) * 0.7;
    const v = Math.round(baseVol * clamp(volMult, 0.35, 4));
    candles.push({ t: d.getTime(), o: round2(o), h: round2(h), l: round2(Math.max(0.4, l)), c: round2(c), v });
    price = c;
  }

  // Rescale so the last close lands near basePrice (keeps caps/PE sane).
  const scale = e.basePrice / candles[candles.length - 1].c;
  for (const k of candles) {
    k.o = round2(k.o * scale); k.h = round2(k.h * scale);
    k.l = round2(k.l * scale); k.c = round2(k.c * scale);
  }
  return candles;
}

function genIntraday(e: UniverseEntry, daily: Candle[]): Candle[] {
  // 5-minute bars for the most recent session, seeded per symbol+day.
  const last = daily[daily.length - 1];
  const prev = daily[daily.length - 2] ?? last;
  const rng = mulberry32(hashStr(e.symbol + new Date(last.t).toDateString()));
  const bars: Candle[] = [];
  const open = prev.c * (1 + (rng() - 0.5) * 0.008);
  const target = last.c;
  const n = 78; // 6.5h of 5-min bars
  let p = open;
  const sessionStart = last.t + 9.5 * 3600 * 1000;
  for (let i = 0; i < n; i++) {
    const pull = (target - p) / (n - i); // drift toward the daily close
    const noise = (rng() - 0.5) * prev.c * 0.0035;
    const o = p;
    const c = p + pull + noise;
    const w = Math.abs(noise) + prev.c * 0.0008;
    bars.push({
      t: sessionStart + i * 5 * 60 * 1000,
      o: round2(o), c: round2(c),
      h: round2(Math.max(o, c) + w * rng()),
      l: round2(Math.min(o, c) - w * rng()),
      v: Math.round((last.v / n) * (0.4 + rng() * 1.6)),
    });
    p = c;
  }
  return bars;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function state(symbol: string): SymState {
  let s = cache.get(symbol);
  if (s) return s;
  const e = findEntry(symbol);
  if (!e) throw new Error(`Unknown symbol ${symbol}`);
  const daily = genDaily(e);
  const intraday = genIntraday(e, daily);
  const last = daily[daily.length - 1];
  const prev = daily[daily.length - 2] ?? last;
  const avgVolume = Math.round(daily.slice(-50).reduce((a, c) => a + c.v, 0) / 50);
  s = {
    daily,
    intraday,
    quote: {
      symbol,
      price: last.c,
      change: round2(last.c - prev.c),
      changePct: round2(((last.c - prev.c) / prev.c) * 100),
      dayHigh: last.h,
      dayLow: last.l,
      volume: last.v,
      avgVolume,
      updatedAt: Date.now(),
      freshness: "simulated",
    },
  };
  cache.set(symbol, s);
  return s;
}

/** Live tick simulation: small random-walk nudges on the latest price. */
const tickListeners = new Map<string, Set<(q: Quote) => void>>();
let tickTimer: number | null = null;

function ensureTicker() {
  if (tickTimer != null) return;
  tickTimer = window.setInterval(() => {
    for (const [symbol, subs] of tickListeners) {
      if (subs.size === 0) continue;
      const s = cache.get(symbol);
      if (!s) continue;
      const q = s.quote;
      const drift = (Math.random() - 0.5) * q.price * 0.0009;
      const price = round2(Math.max(0.4, q.price + drift));
      const prevClose = s.daily[s.daily.length - 2]?.c ?? price;
      s.quote = {
        ...q,
        price,
        change: round2(price - prevClose),
        changePct: round2(((price - prevClose) / prevClose) * 100),
        dayHigh: Math.max(q.dayHigh, price),
        dayLow: Math.min(q.dayLow, price),
        volume: q.volume + Math.round(Math.random() * 12000),
        updatedAt: Date.now(),
      };
      subs.forEach((cb) => cb(s.quote));
    }
  }, 2500);
}

function sliceForTimeframe(daily: Candle[], intraday: Candle[], tf: Timeframe): Candle[] {
  switch (tf) {
    case "1D": return intraday;
    case "5D": return daily.slice(-5); // daily bars for a week view
    case "1M": return daily.slice(-22);
    case "3M": return daily.slice(-64);
    case "6M": return daily.slice(-128);
    case "1Y": return daily.slice(-252);
    case "5Y": return daily; // full simulated history (~2.5y in prototype)
  }
}

export const mockProvider: MarketDataProvider = {
  id: "mock",
  name: "Mentor Simulated Feed",
  freshness: "simulated",

  getUniverse: () => UNIVERSE,

  async getQuote(symbol) {
    return state(symbol).quote;
  },

  async getQuotes(symbols) {
    return symbols.map((s) => state(s).quote);
  },

  async getCandles(symbol, timeframe) {
    const s = state(symbol);
    return sliceForTimeframe(s.daily, s.intraday, timeframe);
  },

  async getDailyHistory(symbol) {
    return state(symbol).daily;
  },

  async getCompany(symbol) {
    const e = findEntry(symbol);
    if (!e) throw new Error(`Unknown symbol ${symbol}`);
    const s = state(symbol);
    const rng = mulberry32(hashStr(symbol + ":fund"));
    const price = s.quote.price;
    const shares = e.baseCap / e.basePrice;
    const eps = e.drift < -0.4 && rng() < 0.4 ? null : round2((e.basePrice / (14 + rng() * 30)) * (0.8 + rng() * 0.4));
    const pe = eps ? round2(price / eps) : null;
    const info: CompanyInfo = {
      symbol,
      name: e.name,
      sector: e.sector,
      industry: e.industry,
      universe: e.universe,
      marketCap: Math.round(shares * price),
      pe,
      forwardPe: pe ? round2(pe * (0.78 + rng() * 0.3)) : null,
      eps,
      revenue: Math.round(e.baseCap * (0.12 + rng() * 0.5)),
      dividendYield: rng() < 0.45 ? round2(0.3 + rng() * 3.2) : null,
      beta: round2(0.6 + rng() * 1.3 + (e.universe === "russell2000" ? 0.3 : 0)),
      summary: e.summary,
    };
    return info;
  },

  async getIndexSummaries() {
    // Build synthetic index series from universe averages.
    const mk = (id: string, name: string, base: number, symbols: string[]): IndexSummary => {
      const rets: number[] = [];
      for (let i = 29; i >= 0; i--) {
        let sum = 0;
        for (const sym of symbols) {
          const d = state(sym).daily;
          const a = d[d.length - 2 - i], b = d[d.length - 1 - i];
          if (a && b) sum += (b.c - a.c) / a.c;
        }
        rets.push(sum / symbols.length);
      }
      const spark: number[] = [base];
      for (const r of rets) spark.push(spark[spark.length - 1] * (1 + r));
      const value = spark[spark.length - 1];
      const prev = spark[spark.length - 2];
      return {
        id, name,
        value: round2(value),
        change: round2(value - prev),
        changePct: round2(((value - prev) / prev) * 100),
        spark: spark.map((x) => round2(x)),
      };
    };
    const spSyms = UNIVERSE.filter((u) => u.universe === "sp500").map((u) => u.symbol);
    const rtSyms = UNIVERSE.filter((u) => u.universe === "russell2000").map((u) => u.symbol);
    return [
      mk("spx", "S&P 500", 6120, spSyms.slice(0, 20)),
      mk("ndx", "Nasdaq 100", 22150, spSyms.filter((s) => ["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","NFLX","AMD","ADBE","INTC"].includes(s))),
      mk("rut", "Russell 2000", 2310, rtSyms),
      mk("dji", "Dow Jones", 44780, spSyms.slice(5, 25)),
    ];
  },

  subscribeQuotes(symbols, cb) {
    ensureTicker();
    for (const sym of symbols) {
      state(sym); // warm cache
      let set = tickListeners.get(sym);
      if (!set) tickListeners.set(sym, (set = new Set()));
      set.add(cb);
    }
    return () => {
      for (const sym of symbols) tickListeners.get(sym)?.delete(cb);
    };
  },
};
