import type { ScanSnapshot } from "./types";
import { provider } from "./data/provider";
import { WORKER_BASE } from "./data/liveProvider";

/**
 * Self-benchmark ("track record"): does the scanner's method actually work?
 *
 * Once per trading day, the first live scan that completes records a cohort —
 * the top 5 "Strong setup" S&P 500 picks with their entry prices, plus the
 * S&P 500 level at that moment. Cohorts are immutable (server verifies every
 * price against live data and rejects duplicates), so the record can't be
 * curated after the fact. The Track Record page measures each cohort against
 * the S&P over the identical window.
 */

export interface BenchPick {
  symbol: string;
  price: number;
  score: number;
}

export type HorizonKey = "1w" | "1m" | "3m";

/** A frozen verdict: computed once from historical closes, never changes. */
export interface SettledHorizon {
  settledAt: number;
  avgRet: number;
  spxRet: number;
  alpha: number;
  picks: { symbol: string; ret: number | null }[];
}

export interface BenchCohort {
  date: string;
  at: number;
  spx: number;
  picks: BenchPick[];
  /** Fixed-horizon verdicts, settled server-side as they mature. */
  settled?: Partial<Record<HorizonKey, SettledHorizon>>;
}

const GUARD_KEY = "mm:benchRecorded";

/** Fire-and-forget: record today's cohort if it qualifies. Never throws. */
export async function recordBenchmark(snap: ScanSnapshot): Promise<void> {
  try {
    if (provider().id !== "live") return; // only real prices count
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(GUARD_KEY) === today) return; // server dedupes too

    // Top 5 large caps at "Strong setup" (>= 50% of max score).
    const picks = snap.results
      .filter((r) => r.universe === "sp500" && r.score >= r.maxScore * 0.5)
      .slice(0, 5)
      .map((r) => ({ symbol: r.symbol, price: r.price, score: r.score }));
    if (picks.length < 3) return; // thin days don't make a cohort

    const ix = await provider().getIndexSummaries();
    const spx = ix.find((i) => i.id === "spx")?.value;
    if (!spx) return;

    const res = await fetch(`${WORKER_BASE}/bench/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks, spx }),
    });
    if (res.ok) localStorage.setItem(GUARD_KEY, today);
  } catch {
    /* benchmarking must never disturb the scan */
  }
}

export async function fetchBenchmark(): Promise<BenchCohort[]> {
  const res = await fetch(`${WORKER_BASE}/bench/list`);
  if (!res.ok) throw new Error("Track record unavailable right now");
  const { cohorts } = (await res.json()) as { cohorts: BenchCohort[] };
  return (cohorts ?? []).sort((a, b) => (a.date < b.date ? 1 : -1));
}
