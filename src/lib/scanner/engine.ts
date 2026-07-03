import type { Candle, ConditionResult, ScanResult } from "../types";
import { computeBundle, priorHigh, relativeVolume, slopePctPerDay, type IndicatorBundle } from "../indicators/core";
import { detectChartPatterns } from "../patterns/chartPatterns";
import { provider } from "../data/provider";

/**
 * Transparent bullish-setup scanner.
 *
 * Every condition is listed here with its weight and a plain-English detail
 * string. The score is simply the sum of met-condition weights — no hidden
 * math. Results always include the full condition breakdown so the UI can
 * show exactly WHY a stock scored what it did.
 */

export interface ScanCondition {
  id: string;
  label: string;
  weight: number;
  /** Beginner-friendly one-liner shown in tooltips. */
  help: string;
  test: (candles: Candle[], b: IndicatorBundle) => { met: boolean; detail: string };
}

const last = (xs: number[]) => xs[xs.length - 1];
const prev = (xs: number[]) => xs[xs.length - 2];

export const SCAN_CONDITIONS: ScanCondition[] = [
  {
    id: "above-mas",
    label: "Price above 50, 150 & 200-day averages",
    weight: 12,
    help: "Trading above its long-term averages means the stock is in an established uptrend.",
    test: (c, b) => {
      const p = last(b.closes);
      const met = p > last(b.sma50) && p > last(b.sma150) && p > last(b.sma200);
      return { met, detail: met ? `Price ${p.toFixed(2)} is above the 50-day (${last(b.sma50).toFixed(2)}), 150-day and 200-day averages.` : `Price ${p.toFixed(2)} is below at least one key average.` };
    },
  },
  {
    id: "ma-alignment",
    label: "50 > 150 > 200 average alignment",
    weight: 10,
    help: "Shorter averages stacked above longer ones is the classic signature of a healthy uptrend.",
    test: (_c, b) => {
      const met = last(b.sma50) > last(b.sma150) && last(b.sma150) > last(b.sma200);
      return { met, detail: met ? "Moving averages are stacked bullishly: 50-day above 150-day above 200-day." : "Moving averages are not in bullish order yet." };
    },
  },
  {
    id: "cross-50",
    label: "Recently crossed above 50-day average",
    weight: 8,
    help: "A fresh cross above the 50-day average can mark the start of a new leg up.",
    test: (_c, b) => {
      const now = last(b.closes) > last(b.sma50);
      const crossed = now && b.closes.slice(-6, -1).some((p, i) => p <= b.sma50[b.sma50.length - 6 + i]);
      return { met: crossed, detail: crossed ? "Price crossed above its 50-day average within the last 5 sessions." : "No fresh 50-day average cross in the last 5 sessions." };
    },
  },
  {
    id: "cross-200",
    label: "Recently crossed above 200-day average",
    weight: 9,
    help: "Reclaiming the 200-day average is a widely watched trend-change signal.",
    test: (_c, b) => {
      const now = last(b.closes) > last(b.sma200);
      const crossed = now && b.closes.slice(-8, -1).some((p, i) => p <= b.sma200[b.sma200.length - 8 + i]);
      return { met: crossed, detail: crossed ? "Price reclaimed its 200-day average within the last 7 sessions — a widely watched signal." : "No fresh 200-day average cross in the last 7 sessions." };
    },
  },
  {
    id: "sma200-rising",
    label: "200-day average sloping upward",
    weight: 8,
    help: "A rising 200-day average confirms the long-term trend is up, not just a short bounce.",
    test: (_c, b) => {
      const slope = slopePctPerDay(b.sma200, 40);
      const met = slope > 0.02;
      return { met, detail: met ? `200-day average is rising (~${slope.toFixed(2)}%/day over the last 2 months).` : "200-day average is flat or falling." };
    },
  },
  {
    id: "rsi-recovery",
    label: "RSI recovering (crossed back above 50)",
    weight: 7,
    help: "RSI climbing back above 50 after a dip suggests momentum is turning positive again.",
    test: (_c, b) => {
      const r = b.rsi14;
      const nowAbove = last(r) > 50 && last(r) < 72;
      const wasBelow = r.slice(-12, -1).some((x) => x < 47);
      const met = nowAbove && wasBelow;
      return { met, detail: met ? `RSI recovered to ${last(r).toFixed(0)} after dipping below 47 — momentum turning up without being overbought.` : `RSI is ${isNaN(last(r)) ? "n/a" : last(r).toFixed(0)}; no recent recovery pattern.` };
    },
  },
  {
    id: "macd-cross",
    label: "MACD bullish crossover",
    weight: 9,
    help: "The MACD line crossing above its signal line is a classic momentum shift to the upside.",
    test: (_c, b) => {
      const { macd: m, signal: s } = b.macd;
      const crossed = last(m) > last(s) &&
        m.slice(-7, -1).some((x, i) => x <= s[s.length - 7 + i]);
      return { met: crossed, detail: crossed ? "MACD line crossed above its signal line within the last 6 sessions." : "No recent MACD bullish crossover." };
    },
  },
  {
    id: "rel-volume",
    label: "Relative volume expansion (≥1.5×)",
    weight: 8,
    help: "Volume well above average means unusual interest — moves on high volume carry more weight.",
    test: (c) => {
      const rv = relativeVolume(c);
      const met = rv >= 1.5;
      return { met, detail: met ? `Volume is ${rv.toFixed(1)}× its 20-day average — unusual interest.` : `Volume is ${rv.toFixed(1)}× its 20-day average (normal).` };
    },
  },
  {
    id: "near-resistance",
    label: "Consolidating near resistance",
    weight: 7,
    help: "Price coiling just under a ceiling shows buyers absorbing supply — breakouts often start here.",
    test: (c, b) => {
      const hi = priorHigh(c, 60);
      const p = last(b.closes);
      const closeToHigh = p >= hi * 0.95 && p <= hi * 1.005;
      const recent = b.closes.slice(-10);
      const rangePct = (Math.max(...recent) - Math.min(...recent)) / p;
      const met = closeToHigh && rangePct < 0.06;
      return { met, detail: met ? `Price is within ${((1 - p / hi) * 100).toFixed(1)}% of its 60-day high while trading in a tight ${(rangePct * 100).toFixed(1)}% range.` : "Not consolidating near a recent high." };
    },
  },
  {
    id: "breakout",
    label: "Breakout above recent highs",
    weight: 10,
    help: "Closing above the highest price of the last ~3 months signals buyers won the standoff.",
    test: (c, b) => {
      const hi = priorHigh(c, 60);
      const met = last(b.closes) > hi * 1.002;
      return { met, detail: met ? `Closed at ${last(b.closes).toFixed(2)}, above the prior 60-day high of ${hi.toFixed(2)}.` : `Still below the 60-day high of ${hi.toFixed(2)}.` };
    },
  },
  {
    id: "tight-action",
    label: "Tight price action after an advance",
    weight: 6,
    help: "Small, quiet candles after a strong run mean holders aren't selling — often a launchpad.",
    test: (c, b) => {
      const closes = b.closes;
      const runup = (closes[closes.length - 11] - closes[closes.length - 31]) / closes[closes.length - 31];
      const recent = closes.slice(-10);
      const rangePct = (Math.max(...recent) - Math.min(...recent)) / last(closes);
      const met = runup > 0.08 && rangePct < 0.05;
      return { met, detail: met ? `After a ${(runup * 100).toFixed(0)}% advance, price has gone quiet in a ${(rangePct * 100).toFixed(1)}% range — holders are sitting tight.` : "No tight consolidation after an advance." };
    },
  },
];

export const MAX_SCORE = SCAN_CONDITIONS.reduce((a, c) => a + c.weight, 0);
/** Pattern bonus: up to this many extra points for high-confidence bullish patterns. */
export const PATTERN_BONUS_MAX = 8;

export function evaluateSymbol(symbol: string, candles: Candle[]): Omit<ScanResult, "name" | "sector" | "universe" | "price" | "changePct"> {
  const b = computeBundle(candles);
  const conditions: ConditionResult[] = SCAN_CONDITIONS.map((c) => {
    const { met, detail } = c.test(candles, b);
    return { id: c.id, label: c.label, met, weight: c.weight, detail };
  });
  let score = conditions.filter((c) => c.met).reduce((a, c) => a + c.weight, 0);

  const patterns = detectChartPatterns(candles).filter((p) => p.bias === "bullish");
  const bestPattern = patterns[0];
  if (bestPattern) score += Math.round(bestPattern.confidence * PATTERN_BONUS_MAX);

  const met = conditions.filter((c) => c.met);
  const summary =
    met.length === 0
      ? "No bullish conditions met right now."
      : `${met.length} of ${conditions.length} bullish conditions met` +
        (bestPattern ? `, plus a possible ${bestPattern.label.toLowerCase()} pattern (${Math.round(bestPattern.confidence * 100)}% confidence).` : ".");

  return {
    symbol,
    score,
    maxScore: MAX_SCORE + PATTERN_BONUS_MAX,
    conditions,
    patterns,
    candles60: candles.slice(-60),
    summary,
  };
}

let scanCache: { at: number; results: ScanResult[] } | null = null;

/** Scan the whole universe. Cached for 2 minutes (background-job stand-in). */
export async function scanUniverse(force = false): Promise<ScanResult[]> {
  if (!force && scanCache && Date.now() - scanCache.at < 120_000) return scanCache.results;
  const p = provider();
  const entries = p.getUniverse();
  const results: ScanResult[] = [];
  for (const e of entries) {
    const candles = await p.getDailyHistory(e.symbol);
    const quote = await p.getQuote(e.symbol);
    const ev = evaluateSymbol(e.symbol, candles);
    results.push({
      ...ev,
      name: e.name,
      sector: e.sector,
      universe: e.universe,
      price: quote.price,
      changePct: quote.changePct,
    });
  }
  results.sort((a, b) => b.score - a.score);
  scanCache = { at: Date.now(), results };
  return results;
}

/** Human label for a score band, used with the confidence badge. */
export function scoreBand(score: number, maxScore: number): { label: string; tone: "strong" | "moderate" | "weak" } {
  const pct = score / maxScore;
  if (pct >= 0.5) return { label: "Strong setup", tone: "strong" };
  if (pct >= 0.3) return { label: "Developing setup", tone: "moderate" };
  return { label: "Weak / early", tone: "weak" };
}
