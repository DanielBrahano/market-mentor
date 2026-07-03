import type { Candle, CompanyInfo, DataFreshness, IndexSummary, Quote, Timeframe } from "../types";
import type { UniverseEntry } from "./universe";

/**
 * Market data provider abstraction.
 *
 * The whole app talks to this interface only — never to a vendor SDK directly.
 * Swapping in Polygon, Finnhub, Alpaca, IEX, etc. means implementing this
 * interface and calling `setProvider()`. Every payload carries a freshness
 * label so the UI can honestly tell users how fresh the data is.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly name: string;
  /** What this provider can actually deliver, shown in the data-source badge. */
  readonly freshness: DataFreshness;

  getUniverse(): UniverseEntry[];
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  /** Daily (or intraday for 1D/5D) candles for a timeframe, oldest first. */
  getCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]>;
  /** Full daily history used by the scanner/indicators (~2 years). */
  getDailyHistory(symbol: string): Promise<Candle[]>;
  getCompany(symbol: string): Promise<CompanyInfo>;
  getIndexSummaries(): Promise<IndexSummary[]>;
  /** Subscribe to lightweight quote ticks. Returns unsubscribe. */
  subscribeQuotes(symbols: string[], cb: (q: Quote) => void): () => void;
}

let active: MarketDataProvider | null = null;

export function setProvider(p: MarketDataProvider) {
  active = p;
}

export function provider(): MarketDataProvider {
  if (!active) throw new Error("No market data provider registered");
  return active;
}

export const FRESHNESS_LABEL: Record<DataFreshness, string> = {
  realtime: "Real-time",
  "near-realtime": "Near real-time",
  delayed: "Delayed 15 min",
  simulated: "Simulated data",
};

export const FRESHNESS_HELP: Record<DataFreshness, string> = {
  realtime: "Prices update live as trades happen.",
  "near-realtime": "Prices update within about a minute of live trading.",
  delayed: "Prices are delayed about 15 minutes from live trading.",
  simulated: "This prototype uses realistic simulated market data. Numbers move like real markets but are not live quotes.",
};
