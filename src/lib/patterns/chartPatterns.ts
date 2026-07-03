import type { Candle, PatternHit, PatternKind } from "../types";
import { sma } from "../indicators/core";

/**
 * Chart pattern detection engine.
 *
 * Approach (transparent, not a black box):
 * 1. Find swing highs/lows (pivots) using a symmetric window.
 * 2. Test pivot sequences against geometric rules for each pattern.
 * 3. Score confidence from how cleanly the geometry fits (symmetry,
 *    touch counts, trend context, volume behavior).
 *
 * Pattern recognition is inherently probabilistic — confidence < 1 always.
 */

interface Pivot { index: number; price: number; kind: "high" | "low" }

export function findPivots(candles: Candle[], window = 4): Pivot[] {
  const out: Pivot[] = [];
  for (let i = window; i < candles.length - window; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (candles[j].h >= candles[i].h) isHigh = false;
      if (candles[j].l <= candles[i].l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ index: i, price: candles[i].h, kind: "high" });
    else if (isLow) out.push({ index: i, price: candles[i].l, kind: "low" });
  }
  return out;
}

const near = (a: number, b: number, tolPct: number) => Math.abs(a - b) / ((a + b) / 2) <= tolPct;

function hit(kind: PatternKind, label: string, bias: PatternHit["bias"], confidence: number,
  startIndex: number, endIndex: number, keyPoints: PatternHit["keyPoints"], explanation: string): PatternHit {
  return { kind, label, bias, confidence: Math.round(confidence * 100) / 100, startIndex, endIndex, keyPoints, explanation };
}

/** Detect all supported patterns over the recent window of daily candles. */
export function detectChartPatterns(candles: Candle[], lookback = 130): PatternHit[] {
  if (candles.length < 60) return [];
  const seg = candles.slice(-lookback);
  const offset = candles.length - seg.length;
  const pivots = findPivots(seg);
  const highs = pivots.filter((p) => p.kind === "high");
  const lows = pivots.filter((p) => p.kind === "low");
  const hits: PatternHit[] = [];
  const lastIdx = seg.length - 1;
  const lastClose = seg[lastIdx].c;

  // --- Double top / bottom ---
  for (let i = 0; i + 1 < highs.length; i++) {
    const a = highs[i], b = highs[i + 1];
    if (b.index - a.index < 10 || b.index - a.index > 60) continue;
    if (!near(a.price, b.price, 0.025)) continue;
    const valley = lows.filter((l) => l.index > a.index && l.index < b.index).sort((x, y) => x.price - y.price)[0];
    if (!valley || (a.price - valley.price) / a.price < 0.04) continue;
    if (lastIdx - b.index > 25) continue;
    const conf = 0.5 + (near(a.price, b.price, 0.012) ? 0.15 : 0) + (lastClose < valley.price ? 0.2 : 0.05);
    hits.push(hit("double-top", "Double Top", "bearish", Math.min(conf, 0.9), a.index + offset, lastIdx + offset,
      [{ index: a.index + offset, price: a.price, role: "First peak" }, { index: valley.index + offset, price: valley.price, role: "Valley (neckline)" }, { index: b.index + offset, price: b.price, role: "Second peak" }],
      `Price rallied to about the same level twice (${a.price.toFixed(2)} and ${b.price.toFixed(2)}) and was rejected both times — buyers may be running out of strength there.`));
  }
  for (let i = 0; i + 1 < lows.length; i++) {
    const a = lows[i], b = lows[i + 1];
    if (b.index - a.index < 10 || b.index - a.index > 60) continue;
    if (!near(a.price, b.price, 0.025)) continue;
    const peak = highs.filter((h) => h.index > a.index && h.index < b.index).sort((x, y) => y.price - x.price)[0];
    if (!peak || (peak.price - a.price) / a.price < 0.04) continue;
    if (lastIdx - b.index > 25) continue;
    const conf = 0.5 + (near(a.price, b.price, 0.012) ? 0.15 : 0) + (lastClose > peak.price ? 0.2 : 0.05);
    hits.push(hit("double-bottom", "Double Bottom", "bullish", Math.min(conf, 0.9), a.index + offset, lastIdx + offset,
      [{ index: a.index + offset, price: a.price, role: "First low" }, { index: peak.index + offset, price: peak.price, role: "Peak (neckline)" }, { index: b.index + offset, price: b.price, role: "Second low" }],
      `Price fell to about the same level twice (${a.price.toFixed(2)} and ${b.price.toFixed(2)}) and bounced both times — sellers failed to push it lower, which can mark a floor.`));
  }

  // --- Head & shoulders / inverse ---
  for (let i = 0; i + 2 < highs.length; i++) {
    const [l, h, r] = [highs[i], highs[i + 1], highs[i + 2]];
    if (r.index - l.index > 90 || lastIdx - r.index > 20) continue;
    if (h.price > l.price * 1.02 && h.price > r.price * 1.02 && near(l.price, r.price, 0.04)) {
      const conf = 0.45 + (near(l.price, r.price, 0.015) ? 0.15 : 0) + 0.1;
      hits.push(hit("head-and-shoulders", "Head & Shoulders", "bearish", conf, l.index + offset, lastIdx + offset,
        [{ index: l.index + offset, price: l.price, role: "Left shoulder" }, { index: h.index + offset, price: h.price, role: "Head" }, { index: r.index + offset, price: r.price, role: "Right shoulder" }],
        "Three peaks with the middle one tallest. The failure to make a new high on the third push suggests the uptrend may be tiring."));
    }
  }
  for (let i = 0; i + 2 < lows.length; i++) {
    const [l, h, r] = [lows[i], lows[i + 1], lows[i + 2]];
    if (r.index - l.index > 90 || lastIdx - r.index > 20) continue;
    if (h.price < l.price * 0.98 && h.price < r.price * 0.98 && near(l.price, r.price, 0.04)) {
      const conf = 0.45 + (near(l.price, r.price, 0.015) ? 0.15 : 0) + 0.1;
      hits.push(hit("inverse-head-and-shoulders", "Inverse Head & Shoulders", "bullish", conf, l.index + offset, lastIdx + offset,
        [{ index: l.index + offset, price: l.price, role: "Left shoulder" }, { index: h.index + offset, price: h.price, role: "Head" }, { index: r.index + offset, price: r.price, role: "Right shoulder" }],
        "Three dips with the middle one deepest. Sellers pushed hardest in the middle and failed twice after — often an early sign of a bottom."));
    }
  }

  // --- Triangles & rectangle (flat vs rising/falling boundaries over recent pivots) ---
  const recentHighs = highs.filter((h) => lastIdx - h.index <= 55).slice(-4);
  const recentLows = lows.filter((l) => lastIdx - l.index <= 55).slice(-4);
  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const hFlat = near(recentHighs[0].price, recentHighs[recentHighs.length - 1].price, 0.02);
    const lFlat = near(recentLows[0].price, recentLows[recentLows.length - 1].price, 0.02);
    const lRising = recentLows[recentLows.length - 1].price > recentLows[0].price * 1.025;
    const hFalling = recentHighs[recentHighs.length - 1].price < recentHighs[0].price * 0.975;
    const startI = Math.min(recentHighs[0].index, recentLows[0].index);
    const kp = [
      ...recentHighs.map((p) => ({ index: p.index + offset, price: p.price, role: "Resistance touch" })),
      ...recentLows.map((p) => ({ index: p.index + offset, price: p.price, role: "Support touch" })),
    ];
    if (hFlat && lRising) {
      const conf = 0.5 + Math.min(0.1 * (recentHighs.length - 2 + recentLows.length - 2), 0.25);
      hits.push(hit("ascending-triangle", "Ascending Triangle", "bullish", conf, startI + offset, lastIdx + offset, kp,
        "Sellers keep defending the same ceiling while buyers step in at higher and higher levels — pressure is building against resistance, which often precedes a breakout attempt."));
    } else if (lFlat && hFalling) {
      const conf = 0.5 + Math.min(0.1 * (recentHighs.length - 2 + recentLows.length - 2), 0.25);
      hits.push(hit("descending-triangle", "Descending Triangle", "bearish", conf, startI + offset, lastIdx + offset, kp,
        "Buyers keep defending the same floor while sellers appear at lower and lower levels — pressure is building against support."));
    } else if (hFlat && lFlat && recentHighs[0].price > recentLows[0].price * 1.03) {
      hits.push(hit("rectangle", "Rectangle / Consolidation", "neutral", 0.55, startI + offset, lastIdx + offset, kp,
        "Price is bouncing between a clear floor and ceiling — the market is undecided. A close beyond either boundary often sets the next direction."));
    }
  }

  // --- Bull / bear flag: sharp move then tight counter-drift ---
  const closes = seg.map((c) => c.c);
  if (seg.length > 40) {
    const poleStart = seg.length - 25, poleEnd = seg.length - 10;
    const poleRet = (closes[poleEnd] - closes[poleStart]) / closes[poleStart];
    const flagSeg = closes.slice(poleEnd);
    const flagRet = (flagSeg[flagSeg.length - 1] - flagSeg[0]) / flagSeg[0];
    const flagRange = (Math.max(...flagSeg) - Math.min(...flagSeg)) / flagSeg[0];
    if (poleRet > 0.10 && flagRet <= 0.01 && flagRet > -0.06 && flagRange < 0.08) {
      const conf = 0.5 + Math.min(poleRet, 0.25) + (flagRange < 0.05 ? 0.1 : 0);
      hits.push(hit("bull-flag", "Bull Flag", "bullish", Math.min(conf, 0.88), poleStart + offset, lastIdx + offset,
        [{ index: poleStart + offset, price: closes[poleStart], role: "Pole start" }, { index: poleEnd + offset, price: closes[poleEnd], role: "Pole top" }, { index: lastIdx + offset, price: lastClose, role: "Flag" }],
        `A sharp ${(poleRet * 100).toFixed(0)}% advance followed by a small, tight pause. Shallow pullbacks after strong moves suggest holders aren't rushing to sell.`));
    }
    if (poleRet < -0.10 && flagRet >= -0.01 && flagRet < 0.06 && flagRange < 0.08) {
      const conf = 0.5 + Math.min(-poleRet, 0.25);
      hits.push(hit("bear-flag", "Bear Flag", "bearish", Math.min(conf, 0.85), poleStart + offset, lastIdx + offset,
        [{ index: poleStart + offset, price: closes[poleStart], role: "Pole start" }, { index: poleEnd + offset, price: closes[poleEnd], role: "Pole bottom" }, { index: lastIdx + offset, price: lastClose, role: "Flag" }],
        `A sharp ${(Math.abs(poleRet) * 100).toFixed(0)}% decline followed by a weak sideways bounce. Feeble bounces after hard drops suggest sellers are still in control.`));
    }
  }

  // --- Cup and handle: rounded base then small dip near the rim ---
  if (seg.length >= 90) {
    const cup = closes.slice(-90, -12);
    const handle = closes.slice(-12);
    const leftRim = Math.max(...cup.slice(0, 12));
    const rightRim = Math.max(...cup.slice(-12));
    const bottom = Math.min(...cup);
    const depth = (leftRim - bottom) / leftRim;
    const handleLow = Math.min(...handle);
    const bottomIdx = cup.indexOf(bottom);
    const centered = bottomIdx > cup.length * 0.25 && bottomIdx < cup.length * 0.75;
    if (near(leftRim, rightRim, 0.05) && depth > 0.10 && depth < 0.40 && centered &&
        handleLow > bottom + (leftRim - bottom) * 0.5 && lastClose > rightRim * 0.93) {
      const conf = 0.5 + (near(leftRim, rightRim, 0.02) ? 0.1 : 0) + (depth < 0.3 ? 0.1 : 0);
      const cupOffset = seg.length - 90;
      hits.push(hit("cup-and-handle", "Cup and Handle", "bullish", conf, cupOffset + offset, lastIdx + offset,
        [{ index: cupOffset + offset, price: leftRim, role: "Left rim" }, { index: cupOffset + bottomIdx + offset, price: bottom, role: "Cup bottom" }, { index: seg.length - 13 + offset, price: rightRim, role: "Right rim" }, { index: lastIdx + offset, price: lastClose, role: "Handle" }],
        "A rounded recovery back to a prior high, then a small shallow dip (the handle). Long, calm bases like this show sellers gradually giving up."));
    }
  }

  // Dedupe by kind, keep highest confidence, sort desc.
  const best = new Map<PatternKind, PatternHit>();
  for (const h of hits) {
    const cur = best.get(h.kind);
    if (!cur || h.confidence > cur.confidence) best.set(h.kind, h);
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Trend context helper for explanations: is the 200-bar average rising? */
export function trendContext(candles: Candle[]): "uptrend" | "downtrend" | "sideways" {
  const closes = candles.map((c) => c.c);
  const s200 = sma(closes, Math.min(200, Math.floor(closes.length / 2)));
  const last = s200[s200.length - 1], prior = s200[s200.length - 21];
  if (isNaN(last) || isNaN(prior)) return "sideways";
  const chg = (last - prior) / prior;
  return chg > 0.005 ? "uptrend" : chg < -0.005 ? "downtrend" : "sideways";
}
