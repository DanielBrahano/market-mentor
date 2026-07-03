import type { Candle } from "../types";

/**
 * Technical indicator engine. Pure functions over candle arrays.
 * All series are aligned to the input candles: output[i] corresponds to
 * candles[i], with NaN where the indicator is not yet defined.
 */

export function sma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      let s = 0;
      for (let j = 0; j < period; j++) s += values[j];
      prev = s / period;
      out[i] = prev;
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out = new Array(closes.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= period) {
      gain += g; loss += l;
      if (i === period) {
        gain /= period; loss /= period;
        out[i] = 100 - 100 / (1 + (loss === 0 ? 1000 : gain / loss));
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out[i] = 100 - 100 / (1 + (loss === 0 ? 1000 : gain / loss));
    }
  }
  return out;
}

export interface MacdResult { macd: number[]; signal: number[]; histogram: number[] }

export function macd(closes: number[], fast = 12, slow = 26, signalP = 9): MacdResult {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line = closes.map((_, i) => ef[i] - es[i]);
  // signal = EMA of macd line over the defined region
  const defined = line.map((x) => (isNaN(x) ? 0 : x));
  const firstIdx = line.findIndex((x) => !isNaN(x));
  const sig = new Array(closes.length).fill(NaN);
  if (firstIdx >= 0) {
    const k = 2 / (signalP + 1);
    let prev = NaN;
    for (let i = firstIdx; i < closes.length; i++) {
      const rel = i - firstIdx;
      if (rel === signalP - 1) {
        let s = 0;
        for (let j = firstIdx; j <= i; j++) s += defined[j];
        prev = s / signalP;
        sig[i] = prev;
      } else if (rel >= signalP) {
        prev = line[i] * k + prev * (1 - k);
        sig[i] = prev;
      }
    }
  }
  const hist = line.map((x, i) => x - sig[i]);
  return { macd: line, signal: sig, histogram: hist };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(s / period);
    upper[i] = mid[i] + mult * sd;
    lower[i] = mid[i] - mult * sd;
  }
  return { mid, upper, lower };
}

/** Rolling VWAP (per-bar cumulative for intraday; rolling 20 for daily). */
export function vwap(candles: Candle[], rolling: number | null = null): number[] {
  const out = new Array(candles.length).fill(NaN);
  if (rolling == null) {
    let pv = 0, vv = 0;
    for (let i = 0; i < candles.length; i++) {
      const typ = (candles[i].h + candles[i].l + candles[i].c) / 3;
      pv += typ * candles[i].v; vv += candles[i].v;
      out[i] = vv > 0 ? pv / vv : NaN;
    }
  } else {
    for (let i = rolling - 1; i < candles.length; i++) {
      let pv = 0, vv = 0;
      for (let j = i - rolling + 1; j <= i; j++) {
        const typ = (candles[j].h + candles[j].l + candles[j].c) / 3;
        pv += typ * candles[j].v; vv += candles[j].v;
      }
      out[i] = vv > 0 ? pv / vv : NaN;
    }
  }
  return out;
}

export function stochastic(candles: Candle[], kP = 14, dP = 3) {
  const k = new Array(candles.length).fill(NaN);
  for (let i = kP - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - kP + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].h); lo = Math.min(lo, candles[j].l);
    }
    k[i] = hi === lo ? 50 : ((candles[i].c - lo) / (hi - lo)) * 100;
  }
  const dRaw = sma(k.map((x) => (isNaN(x) ? 0 : x)), dP);
  const d = dRaw.map((x, i) => (i < kP - 1 + dP - 1 ? NaN : x));
  return { k, d };
}

/** Relative volume: today's volume vs the trailing `period`-day average. */
export function relativeVolume(candles: Candle[], period = 20): number {
  if (candles.length < period + 1) return 1;
  const last = candles[candles.length - 1];
  const prior = candles.slice(-period - 1, -1);
  const avg = prior.reduce((a, c) => a + c.v, 0) / period;
  return avg > 0 ? last.v / avg : 1;
}

/** Linear-regression slope of the last `lookback` values, as %/day of price. */
export function slopePctPerDay(values: number[], lookback = 40): number {
  const seg = values.slice(-lookback).filter((x) => !isNaN(x));
  const n = seg.length;
  if (n < 5) return 0;
  const xm = (n - 1) / 2;
  const ym = seg.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (seg[i] - ym);
    den += (i - xm) ** 2;
  }
  const slope = num / den;
  return ym !== 0 ? (slope / ym) * 100 : 0;
}

export function atr(candles: Candle[], period = 14): number[] {
  const out = new Array(candles.length).fill(NaN);
  let prev = NaN;
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c),
    );
    if (i <= period) {
      prev = isNaN(prev) ? tr : prev + tr;
      if (i === period) { prev /= period; out[i] = prev; }
    } else {
      prev = (prev * (period - 1) + tr) / period;
      out[i] = prev;
    }
  }
  return out;
}

/** Highest high of the previous `lookback` bars, excluding the last bar. */
export function priorHigh(candles: Candle[], lookback = 60): number {
  const seg = candles.slice(-lookback - 1, -1);
  return seg.reduce((m, c) => Math.max(m, c.h), -Infinity);
}

/** Convenience bundle used by scanner + stock page. */
export interface IndicatorBundle {
  closes: number[];
  sma20: number[]; sma50: number[]; sma100: number[]; sma150: number[]; sma200: number[];
  ema20: number[]; ema50: number[];
  rsi14: number[];
  macd: MacdResult;
  boll: { mid: number[]; upper: number[]; lower: number[] };
  stoch: { k: number[]; d: number[] };
  relVol: number;
  atr14: number[];
}

export function computeBundle(candles: Candle[]): IndicatorBundle {
  const closes = candles.map((c) => c.c);
  return {
    closes,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma100: sma(closes, 100),
    sma150: sma(closes, 150),
    sma200: sma(closes, 200),
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    rsi14: rsi(closes),
    macd: macd(closes),
    boll: bollinger(closes),
    stoch: stochastic(candles),
    relVol: relativeVolume(candles),
    atr14: atr(candles),
  };
}
