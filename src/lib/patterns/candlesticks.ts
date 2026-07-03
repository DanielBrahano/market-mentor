import type { Candle, CandlePatternHit, CandlePatternKind } from "../types";

/**
 * Candlestick pattern detection. Each detector looks at the last few bars
 * and returns a hit with a plain-English explanation. Single candles are
 * weak signals on their own — the UI always says so.
 */

const body = (c: Candle) => Math.abs(c.c - c.o);
const range = (c: Candle) => c.h - c.l;
const upperWick = (c: Candle) => c.h - Math.max(c.o, c.c);
const lowerWick = (c: Candle) => Math.min(c.o, c.c) - c.l;
const bullish = (c: Candle) => c.c > c.o;
const bearish = (c: Candle) => c.c < c.o;

function mk(kind: CandlePatternKind, label: string, bias: CandlePatternHit["bias"], index: number, explanation: string): CandlePatternHit {
  return { kind, label, bias, index, explanation };
}

/** Detect candle patterns at index i (needs up to 2 prior bars). */
export function detectCandleAt(candles: Candle[], i: number): CandlePatternHit[] {
  const c = candles[i];
  if (!c || range(c) === 0) return [];
  const hits: CandlePatternHit[] = [];
  const b = body(c), r = range(c), uw = upperWick(c), lw = lowerWick(c);
  const prev = candles[i - 1];
  const prev2 = candles[i - 2];
  const downtrendBefore = prev2 && prev && prev.c < prev2.c;
  const uptrendBefore = prev2 && prev && prev.c > prev2.c;

  // Doji: tiny body relative to range
  if (b <= r * 0.1) {
    hits.push(mk("doji", "Doji", "neutral", i,
      "Open and close are almost identical — buyers and sellers fought to a draw. On its own it just signals indecision; watch what happens next."));
  }
  // Hammer / inverted hammer (more meaningful after a decline)
  if (b <= r * 0.35 && lw >= b * 2 && uw <= b * 0.6 && b > 0) {
    hits.push(mk("hammer", "Hammer", "bullish", i,
      "Sellers pushed price down hard during the bar, but buyers fought back and closed it near the top. After a decline, this can hint that dip-buyers are stepping in." + (downtrendBefore ? "" : " (Context note: it appeared without a clear prior decline, which weakens it.)")));
  }
  if (b <= r * 0.35 && uw >= b * 2 && lw <= b * 0.6 && b > 0) {
    if (downtrendBefore) {
      hits.push(mk("inverted-hammer", "Inverted Hammer", "bullish", i,
        "Buyers tried to rally price during the bar and were pushed back, but the attempt itself — after a decline — can mark early buying interest. Needs confirmation from the next bar."));
    } else if (uptrendBefore) {
      hits.push(mk("shooting-star", "Shooting Star", "bearish", i,
        "Price spiked higher during the bar but sellers slammed it back down near the open. After a rally, this rejection can warn that the advance is stalling."));
    }
  }
  // Engulfing
  if (prev && bearish(prev) && bullish(c) && c.c >= prev.o && c.o <= prev.c && b > body(prev) * 1.05) {
    hits.push(mk("bullish-engulfing", "Bullish Engulfing", "bullish", i,
      "A green bar completely swallowed the previous red bar — buyers overwhelmed everything sellers did the day before. Stronger when it appears after a decline and on higher volume."));
  }
  if (prev && bullish(prev) && bearish(c) && c.o >= prev.c && c.c <= prev.o && b > body(prev) * 1.05) {
    hits.push(mk("bearish-engulfing", "Bearish Engulfing", "bearish", i,
      "A red bar completely swallowed the previous green bar — sellers erased the prior day's gains and more. Stronger after a rally."));
  }
  // Morning / evening star (3-bar)
  if (prev && prev2) {
    const smallMid = body(prev) <= range(prev) * 0.35;
    if (bearish(prev2) && smallMid && bullish(c) && c.c > (prev2.o + prev2.c) / 2 && body(prev2) > range(prev2) * 0.5) {
      hits.push(mk("morning-star", "Morning Star", "bullish", i,
        "Three-bar sequence: a strong down day, a small indecisive bar, then a strong recovery closing well into the first bar's range. Selling pressure paused, then buyers took over."));
    }
    if (bullish(prev2) && smallMid && bearish(c) && c.c < (prev2.o + prev2.c) / 2 && body(prev2) > range(prev2) * 0.5) {
      hits.push(mk("evening-star", "Evening Star", "bearish", i,
        "Three-bar sequence: a strong up day, a small indecisive bar, then a strong decline erasing much of the gain. Buying pressure paused, then sellers took over."));
    }
  }
  return hits;
}

/** Scan the last `lookback` bars for candle patterns (most recent first). */
export function detectRecentCandlePatterns(candles: Candle[], lookback = 10): CandlePatternHit[] {
  const out: CandlePatternHit[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = candles.length - 1; i >= start; i--) out.push(...detectCandleAt(candles, i));
  return out;
}
