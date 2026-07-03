/** Core shared types for Market Mentor. */

export type UniverseId = "sp500" | "russell2000";

export interface Candle {
  /** ms epoch of bar open */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y";

/** How fresh the data actually is. Always shown to the user. */
export type DataFreshness = "realtime" | "near-realtime" | "delayed" | "simulated";

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
  updatedAt: number;
  freshness: DataFreshness;
}

export interface CompanyInfo {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  universe: UniverseId;
  marketCap: number;
  pe: number | null;
  forwardPe: number | null;
  eps: number | null;
  revenue: number;
  dividendYield: number | null;
  beta: number;
  summary: string;
}

export interface IndexSummary {
  id: string;
  name: string;
  value: number;
  change: number;
  changePct: number;
  spark: number[];
}

export interface BreadthSummary {
  advancers: number;
  decliners: number;
  unchanged: number;
  pctAbove50ma: number;
  pctAbove200ma: number;
  newHighs: number;
  newLows: number;
}

/** One scanner condition evaluation with a plain-English reason. */
export interface ConditionResult {
  id: string;
  label: string;
  met: boolean;
  weight: number;
  detail: string;
}

export interface ScanResult {
  symbol: string;
  name: string;
  sector: string;
  universe: UniverseId;
  price: number;
  changePct: number;
  score: number;
  maxScore: number;
  conditions: ConditionResult[];
  patterns: PatternHit[];
  candles60: Candle[];
  summary: string;
}

export type PatternKind =
  | "head-and-shoulders"
  | "inverse-head-and-shoulders"
  | "double-top"
  | "double-bottom"
  | "ascending-triangle"
  | "descending-triangle"
  | "bull-flag"
  | "bear-flag"
  | "cup-and-handle"
  | "rectangle";

export type CandlePatternKind =
  | "hammer"
  | "inverted-hammer"
  | "bullish-engulfing"
  | "bearish-engulfing"
  | "doji"
  | "morning-star"
  | "evening-star"
  | "shooting-star";

export interface PatternHit {
  kind: PatternKind;
  label: string;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number; // 0..1
  startIndex: number;
  endIndex: number;
  keyPoints: { index: number; price: number; role: string }[];
  explanation: string;
}

export interface CandlePatternHit {
  kind: CandlePatternKind;
  label: string;
  bias: "bullish" | "bearish" | "neutral";
  index: number;
  explanation: string;
}

export type AlertRuleKind =
  | "cross-above-200ma"
  | "cross-above-50ma"
  | "macd-bull-cross"
  | "unusual-volume"
  | "rsi-recovery"
  | "bullish-pattern"
  | "breakout-high";

export interface AlertRule {
  id: string;
  kind: AlertRuleKind;
  symbol: string | "ANY_WATCHLIST";
  enabled: boolean;
  createdAt: number;
}

export interface AlertEvent {
  id: string;
  ruleKind: AlertRuleKind;
  symbol: string;
  title: string;
  body: string;
  explanation: string;
  createdAt: number;
  read: boolean;
  confidence: number | null;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: number;
}

export interface SavedScreen {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
  invitedBy: string | null;
}

export interface UserSettings {
  theme: "dark" | "light";
  beginnerMode: boolean;
  notifications: {
    inApp: boolean;
    push: boolean;
    watchlistOnly: boolean;
    minConfidence: number; // 0..1 threshold for pattern alerts
    quietHours: boolean;
  };
}
