import type { CandlePatternKind, PatternKind } from "../lib/types";

/** Structured education content for indicators, chart patterns and candles. */

export interface IndicatorDoc {
  id: string;
  name: string;
  what: string;
  why: string;
  bullish: string;
  bearish: string;
  limitations: string;
  example: string;
}

export const INDICATOR_DOCS: IndicatorDoc[] = [
  {
    id: "sma",
    name: "Simple Moving Averages (20 / 50 / 100 / 150 / 200)",
    what: "Each line is the average closing price over the last N trading days. Short averages (20) hug the price; long averages (200) show the big-picture trend.",
    why: "They objectively define the trend. Institutions watch the 50-day and 200-day so widely that price often reacts around them — partly because everyone expects it to.",
    bullish: "Price above rising averages; short averages stacked above long ones (50 > 150 > 200); price bouncing off an average during a pullback; a 'golden cross' (50 crossing above 200).",
    bearish: "Price below falling averages; averages stacked bearishly; a 'death cross' (50 crossing below 200); repeated failures to reclaim the 200-day.",
    limitations: "Averages lag — they confirm trends late and whipsaw badly in sideways markets. In a choppy range, MA crosses generate false signal after false signal.",
    example: "A stock pulls back to its rising 50-day average, holds it for three days, then rallies — a textbook trend-continuation entry many funds watch.",
  },
  {
    id: "ema",
    name: "Exponential Moving Averages (20 / 50)",
    what: "Like a simple average but recent days count for more, so the line reacts faster to fresh moves.",
    why: "Faster reaction helps momentum traders catch trend changes earlier than SMAs would show them.",
    bullish: "Price riding above a rising EMA-20; EMA-20 crossing above EMA-50.",
    bearish: "Price rejected repeatedly at a falling EMA-20; EMA-20 crossing below EMA-50.",
    limitations: "More responsive also means more false alarms. An EMA reacts to one big day even if nothing structural changed.",
    example: "In strong rallies, growth stocks often ride the EMA-20 for weeks — every touch is bought until the character changes.",
  },
  {
    id: "bollinger",
    name: "Bollinger Bands",
    what: "A 20-day average with bands drawn 2 standard deviations above and below. The bands widen when volatility rises and squeeze when it falls.",
    why: "They put price in context: near the upper band = stretched vs recent history; a tight squeeze = energy building for a bigger move.",
    bullish: "A 'squeeze' (very narrow bands) resolving upward; price walking up the upper band in a strong trend; bounces off the lower band in an uptrend.",
    bearish: "A squeeze resolving downward; price walking down the lower band; failure at the middle band from below.",
    limitations: "Touching a band is NOT a signal by itself — strong trends hug a band for weeks. The bands describe volatility, they don't predict direction.",
    example: "After two quiet weeks the bands pinch to their narrowest in months; the next range expansion breaks upward on volume.",
  },
  {
    id: "vwap",
    name: "VWAP (Volume-Weighted Average Price)",
    what: "The average price weighted by how much volume traded at each level — the 'fair price' most shares actually changed hands at.",
    why: "Institutions benchmark their fills against VWAP, so intraday price often reacts around it. Above VWAP = buyers in control for the session.",
    bullish: "Price holding above a rising VWAP; successful retests of VWAP from above.",
    bearish: "Price repeatedly rejected at VWAP from below.",
    limitations: "VWAP is mainly an intraday tool; it resets each session. On daily charts we show a rolling version, which is a looser concept.",
    example: "A stock gaps up, pulls back to intraday VWAP mid-morning, holds, and trends up the rest of the day.",
  },
  {
    id: "rsi",
    name: "RSI (Relative Strength Index)",
    what: "A 0–100 gauge comparing the size of recent gains to recent losses over 14 periods.",
    why: "It quantifies momentum: sustained readings above 50 accompany uptrends, and extremes flag stretched conditions worth watching.",
    bullish: "RSI recovering through 50 after a dip; 'bullish divergence' (price makes a lower low but RSI makes a higher low); holding 40+ during pullbacks in an uptrend.",
    bearish: "RSI failing at 50–60 repeatedly in a downtrend; bearish divergence at highs.",
    limitations: "'Overbought' does not mean 'sell' — the strongest stocks stay above 70 for weeks. RSI works poorly as a standalone timing tool; use it with trend context.",
    example: "A stock in an uptrend dips for two weeks, RSI touches 38 and turns back up through 50 as price reclaims the 50-day average.",
  },
  {
    id: "macd",
    name: "MACD",
    what: "The gap between a fast (12-day) and slow (26-day) exponential average, plus a 9-day signal line and a histogram of the difference.",
    why: "It captures both trend and momentum in one picture: which average is winning, and whether the gap is growing or shrinking.",
    bullish: "MACD crossing above its signal line, especially below zero after a decline; histogram bars shrinking on the negative side (downside momentum fading); MACD crossing above zero.",
    bearish: "MACD crossing below signal at highs; histogram peaking while price still rises (momentum divergence).",
    limitations: "MACD lags price and whipsaws mercilessly in sideways chop. A crossover in a flat range is close to noise.",
    example: "After a pullback in an uptrend, MACD curls up through its signal line the same week price reclaims the 50-day average — two signals agreeing.",
  },
  {
    id: "stochastic",
    name: "Stochastic Oscillator",
    what: "Shows where the current close sits within the recent high-low range, from 0 (at the lows) to 100 (at the highs), with %K and a smoothed %D line.",
    why: "In ranges it flags turns early: closes near the bottom of the range with a %K/%D upturn often precede bounces.",
    bullish: "%K crossing above %D below 20 (oversold turn); repeated holds above 50 in an uptrend.",
    bearish: "%K crossing below %D above 80 in a range; failure to reach 80 on rallies (weakening).",
    limitations: "In strong trends the stochastic pins at extremes and 'oversold' just means 'trending down hard'. It's a range tool first.",
    example: "A stock oscillating between $40 and $46 sees the stochastic turn up from 15 near $40.50 — a range-bounce setup.",
  },
  {
    id: "relative-volume",
    name: "Relative Volume (RVOL)",
    what: "Today's volume divided by the average of the last 20 sessions. 1.0 = normal day, 2.0 = twice normal activity.",
    why: "Volume is conviction. Breakouts, reversals and news reactions on high RVOL are far more likely to follow through than moves on quiet volume.",
    bullish: "Up moves and breakouts on RVOL ≥ 1.5; quiet pullbacks (low RVOL) after high-volume advances.",
    bearish: "Heavy-volume down days ('distribution'); breakouts on weak volume that fade.",
    limitations: "High volume alone doesn't say direction — a 3× volume day can be panic selling. Always pair RVOL with what price actually did.",
    example: "A stock breaks a 3-month base at 2.4× average volume — the crowd showed up for the breakout, which improves its odds.",
  },
];

export interface PatternDoc {
  kind: PatternKind;
  name: string;
  bias: "bullish" | "bearish" | "neutral";
  what: string;
  detection: string;
  psychology: string;
  falseSignals: string;
}

export const PATTERN_DOCS: PatternDoc[] = [
  {
    kind: "head-and-shoulders", name: "Head and Shoulders", bias: "bearish",
    what: "Three peaks with the middle one tallest, like a head between two shoulders. The line connecting the lows between peaks is the 'neckline'. A close below the neckline completes the pattern.",
    detection: "We find three consecutive swing highs where the middle is at least 2% above both outer peaks and the shoulders are within ~4% of each other. Confidence rises with shoulder symmetry.",
    psychology: "Buyers push to a new high (head) but the next rally fails at a lower level (right shoulder) — demand is fading. When the neckline breaks, trapped buyers start selling.",
    falseSignals: "Sloppy, asymmetric versions appear everywhere if you squint. Without a neckline break on volume, it's just three bumps. Works poorly in choppy sideways markets.",
  },
  {
    kind: "inverse-head-and-shoulders", name: "Inverse Head and Shoulders", bias: "bullish",
    what: "The upside-down version: three dips with the middle one deepest. A close above the neckline (the highs between dips) completes it.",
    detection: "Three consecutive swing lows where the middle is at least 2% below both outer lows, shoulders within ~4% of each other.",
    psychology: "Sellers force a capitulation low (head), but the next decline stops higher (right shoulder) — supply is drying up. The neckline break confirms buyers have taken over.",
    falseSignals: "Frequent in long downtrends where every bounce looks like 'the bottom'. Demand real neckline breaks with volume; the pattern alone is hope, not evidence.",
  },
  {
    kind: "double-top", name: "Double Top", bias: "bearish",
    what: "Price hits roughly the same high twice with a valley between, then breaks below the valley. Looks like the letter M.",
    detection: "Two swing highs within 2.5% of each other, 10–60 bars apart, with a valley at least 4% below. Confidence rises when the tops are within ~1% and price has broken the valley.",
    psychology: "The second rally to the same level fails — everyone who wanted to sell at that price still wants to. The M completes when support (the valley) gives way.",
    falseSignals: "Two similar highs happen constantly; most resolve into breakouts, not breakdowns. The pattern means little until the valley low actually breaks.",
  },
  {
    kind: "double-bottom", name: "Double Bottom", bias: "bullish",
    what: "Price hits roughly the same low twice with a bounce between, then breaks above that bounce. Looks like the letter W.",
    detection: "Two swing lows within 2.5% of each other, 10–60 bars apart, with a middle peak at least 4% above. Confidence rises when price clears the middle peak.",
    psychology: "Sellers tried the same level twice and failed — the second test holding shows demand absorbing supply. Clearing the middle peak confirms it.",
    falseSignals: "In persistent downtrends, 'double bottoms' break and become triple bottoms and worse. Wait for the middle-peak breakout; the second low alone is not a signal.",
  },
  {
    kind: "ascending-triangle", name: "Ascending Triangle", bias: "bullish",
    what: "A flat ceiling with rising floors: highs stall at the same level while each dip stops higher than the last, coiling price into a corner.",
    detection: "Recent swing highs within 2% of each other (flat resistance) while swing lows rise at least 2.5% across the pattern.",
    psychology: "A seller keeps offering shares at one price, but buyers get more aggressive on every dip. When the seller runs out, price pops through the ceiling.",
    falseSignals: "Triangles break the 'wrong' way often enough that direction shouldn't be assumed — the odds favor up, but confirmation (a close above resistance) matters.",
  },
  {
    kind: "descending-triangle", name: "Descending Triangle", bias: "bearish",
    what: "A flat floor with falling ceilings: lows hold one level while each bounce tops out lower, squeezing price against support.",
    detection: "Recent swing lows within 2% of each other while swing highs fall at least 2.5% across the pattern.",
    psychology: "A buyer defends one price, but sellers accept less on every bounce. When the buyer is done, the floor collapses.",
    falseSignals: "Same caveat in reverse — descending triangles in strong uptrends frequently break UP. Context and the actual break matter more than the shape.",
  },
  {
    kind: "bull-flag", name: "Bull Flag", bias: "bullish",
    what: "A sharp advance (the pole) followed by a small, tight drift sideways or slightly down (the flag). The pattern completes when price breaks above the flag.",
    detection: "A ≥10% gain over ~15 bars, followed by ~10 bars whose total range stays under 8% and which don't give back more than a small portion of the pole.",
    psychology: "After a burst higher, weak hands take profits — but the pullback stays shallow because new buyers absorb the selling. The trend resumes when supply runs out.",
    falseSignals: "A 'flag' that retraces most of the pole or drags on for weeks is just a failed rally. The tighter and quieter the flag (low volume), the better the odds.",
  },
  {
    kind: "bear-flag", name: "Bear Flag", bias: "bearish",
    what: "A sharp decline followed by a feeble, tight bounce. Completes when price breaks below the flag.",
    detection: "A ≥10% drop over ~15 bars, followed by ~10 bars of weak sideways-to-slightly-up drift in a tight range.",
    psychology: "After heavy selling, bargain hunters nibble — but the bounce is small and volume dries up, showing little real demand. Sellers reload and push through.",
    falseSignals: "Strong V-shaped reversals start out looking exactly like bear flags. If the 'weak bounce' keeps strengthening on volume, the pattern is failing.",
  },
  {
    kind: "cup-and-handle", name: "Cup and Handle", bias: "bullish",
    what: "A long rounded dip back to a prior high (the cup), then a small shallow pullback near the rim (the handle). Completes on a breakout above the rim.",
    detection: "Over ~4 months: both rims within 5% of each other, cup depth 10–40%, bottom roughly centered, handle holding the upper half of the cup, price near the rim.",
    psychology: "A gradual, calm recovery shows sellers slowly giving up rather than a hype spike. The handle shakes out the last impatient holders right before the breakout.",
    falseSignals: "V-shaped cups (crash + instant recovery) and handles that dip into the lower half of the cup are lower quality. Deep cups (>50%) usually mean real damage, not a base.",
  },
  {
    kind: "rectangle", name: "Rectangle / Consolidation", bias: "neutral",
    what: "Price ping-pongs between a clear horizontal floor and ceiling. It's a neutral pattern — the eventual break direction is the signal.",
    detection: "Recent swing highs within 2% of each other AND swing lows within 2% of each other, with at least 3% between floor and ceiling.",
    psychology: "Buyers and sellers agree on a value zone. The longer the range holds, the more stop orders build just outside it — fuel for the eventual breakout move.",
    falseSignals: "Range boundaries invite fakeouts: quick pokes beyond the range that snap back. A daily CLOSE beyond the boundary, ideally on volume, is the more reliable trigger.",
  },
];

export interface CandleDoc {
  kind: CandlePatternKind;
  name: string;
  bias: "bullish" | "bearish" | "neutral";
  what: string;
  context: string;
  warning: string;
  /** Normalized OHLC values (0..1) for the mini visual, one or more candles. */
  shape: { o: number; h: number; l: number; c: number }[];
}

export const CANDLE_DOCS: CandleDoc[] = [
  {
    kind: "hammer", name: "Hammer", bias: "bullish",
    what: "A small body at the top of the bar with a long lower wick (at least 2× the body). Sellers drove price down hard, but buyers pushed it all the way back before the close.",
    context: "Meaningful after a decline or at support — it hints dip-buyers are stepping in. In the middle of a range it means little.",
    warning: "One hammer is a hint, not a bottom. Wait for the next bar to confirm (a strong close higher). Hammers appear at every level of a crash on the way down.",
    shape: [{ o: 0.78, h: 0.95, l: 0.05, c: 0.9 }],
  },
  {
    kind: "inverted-hammer", name: "Inverted Hammer", bias: "bullish",
    what: "A small body at the bottom with a long upper wick, appearing after a decline. Buyers tried to rally price and were pushed back — but the attempt matters.",
    context: "Only counts after a downtrend. The same shape after a rally is a bearish shooting star.",
    warning: "Weaker than a regular hammer; needs a strong green confirmation bar right after. Alone, it's just a failed rally attempt.",
    shape: [{ o: 0.15, h: 0.95, l: 0.05, c: 0.25 }],
  },
  {
    kind: "bullish-engulfing", name: "Bullish Engulfing", bias: "bullish",
    what: "A green candle whose body completely covers the previous red candle's body. Buyers didn't just win the day — they erased the prior day entirely.",
    context: "Strongest after a decline or at support, on above-average volume, and when the engulfing candle is decisively larger.",
    warning: "In a strong downtrend a single engulfing candle often just marks a one-day bounce. Check trend and volume before celebrating.",
    shape: [{ o: 0.62, h: 0.7, l: 0.35, c: 0.4 }, { o: 0.32, h: 0.85, l: 0.25, c: 0.8 }],
  },
  {
    kind: "bearish-engulfing", name: "Bearish Engulfing", bias: "bearish",
    what: "A red candle whose body completely covers the previous green candle's body — sellers erased the prior day's gains and more.",
    context: "Strongest after a rally, at resistance, on high volume.",
    warning: "Strong uptrends shrug off single engulfing candles regularly. It's a caution flag, not a sell-everything signal.",
    shape: [{ o: 0.4, h: 0.68, l: 0.35, c: 0.62 }, { o: 0.7, h: 0.78, l: 0.2, c: 0.25 }],
  },
  {
    kind: "doji", name: "Doji", bias: "neutral",
    what: "Open and close are nearly identical, leaving a cross-shaped bar. Neither side won the session.",
    context: "After a long run, a doji can mark hesitation before a turn. Inside a range, it's just another quiet day.",
    warning: "A doji alone predicts nothing — it flags indecision. The NEXT candle tells you who broke the tie.",
    shape: [{ o: 0.5, h: 0.9, l: 0.1, c: 0.52 }],
  },
  {
    kind: "morning-star", name: "Morning Star", bias: "bullish",
    what: "Three bars: a strong red bar, a small indecisive bar (the 'star'), then a strong green bar closing well into the first bar's range.",
    context: "A classic bottoming sequence after a decline — selling pressure, pause, then buyers take over. More reliable than single-candle signals.",
    warning: "The third bar must be genuinely strong (closing past the midpoint of the first). A weak third bar makes it just three random candles.",
    shape: [{ o: 0.85, h: 0.9, l: 0.4, c: 0.45 }, { o: 0.35, h: 0.45, l: 0.22, c: 0.3 }, { o: 0.38, h: 0.85, l: 0.33, c: 0.8 }],
  },
  {
    kind: "evening-star", name: "Evening Star", bias: "bearish",
    what: "The mirror image: strong green bar, small pause bar, then a strong red bar closing deep into the first bar's gains.",
    context: "A topping sequence after a rally — buying pressure, hesitation, then sellers take control.",
    warning: "Same requirement in reverse: the third bar must close below the first bar's midpoint to mean anything.",
    shape: [{ o: 0.2, h: 0.65, l: 0.15, c: 0.6 }, { o: 0.68, h: 0.8, l: 0.6, c: 0.72 }, { o: 0.65, h: 0.7, l: 0.2, c: 0.28 }],
  },
  {
    kind: "shooting-star", name: "Shooting Star", bias: "bearish",
    what: "A small body at the bottom with a long upper wick, appearing after a rally. Price spiked up and got slammed back down.",
    context: "Only meaningful after an advance, ideally at resistance — it shows sellers aggressively rejecting higher prices.",
    warning: "Strong stocks print shooting stars and keep climbing. Look for confirmation (a red bar next) and where it happened (at resistance vs mid-range).",
    shape: [{ o: 0.25, h: 0.95, l: 0.15, c: 0.18 }],
  },
];
