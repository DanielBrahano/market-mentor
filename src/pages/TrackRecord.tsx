import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Quote } from "../lib/types";
import { fetchBenchmark, type BenchCohort, type HorizonKey, type SettledHorizon } from "../lib/bench";
import { provider } from "../lib/data/provider";
import { classNames, fmtPct, fmtPrice } from "../lib/utils";
import { EmptyState, Skeleton, Tooltip } from "../components/ui";

interface CohortRow {
  cohort: BenchCohort;
  ageDays: number;
  pickRets: { symbol: string; entry: number; now: number | null; ret: number | null; score: number }[];
  avgRet: number | null;
  spxRet: number | null;
  alpha: number | null;
}

export default function TrackRecord() {
  const [cohorts, setCohorts] = useState<BenchCohort[] | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [spxNow, setSpxNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const cs = await fetchBenchmark();
        if (dead) return;
        setCohorts(cs);
        const symbols = [...new Set(cs.flatMap((c) => c.picks.map((p) => p.symbol)))];
        if (symbols.length > 0) {
          const qs = await provider().getQuotes(symbols);
          if (!dead) setQuotes(new Map(qs.map((q) => [q.symbol, q])));
        }
        const ix = await provider().getIndexSummaries();
        if (!dead) setSpxNow(ix.find((i) => i.id === "spx")?.value ?? null);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => { dead = true; };
  }, []);

  const rows: CohortRow[] | null = useMemo(() => {
    if (!cohorts) return null;
    return cohorts.map((cohort) => {
      const pickRets = cohort.picks.map((p) => {
        const now = quotes.get(p.symbol)?.price ?? null;
        return { symbol: p.symbol, entry: p.price, now, ret: now != null ? (now - p.price) / p.price : null, score: p.score };
      });
      const valid = pickRets.filter((p) => p.ret != null) as { ret: number }[];
      const avgRet = valid.length ? valid.reduce((a, p) => a + p.ret, 0) / valid.length : null;
      const spxRet = spxNow != null ? (spxNow - cohort.spx) / cohort.spx : null;
      return {
        cohort,
        ageDays: Math.max(0, Math.round((Date.now() - cohort.at) / 86_400_000)),
        pickRets,
        avgRet,
        spxRet,
        alpha: avgRet != null && spxRet != null ? avgRet - spxRet : null,
      };
    });
  }, [cohorts, quotes, spxNow]);

  const HORIZONS: { key: HorizonKey; label: string; days: string }[] = [
    { key: "1w", label: "1 week", days: "5 trading days" },
    { key: "1m", label: "1 month", days: "21 trading days" },
    { key: "3m", label: "3 months", days: "63 trading days" },
  ];

  // Frozen fixed-horizon verdicts — the accountable numbers.
  const settledAgg = useMemo(() => {
    if (!cohorts) return null;
    return HORIZONS.map((h) => {
      const settled = cohorts.map((c) => c.settled?.[h.key]).filter((s): s is SettledHorizon => !!s);
      if (settled.length === 0) return { ...h, n: 0, avgAlpha: 0, beatRate: 0, winRate: 0, avgRet: 0 };
      const allPicks = settled.flatMap((s) => s.picks.filter((p) => p.ret != null));
      return {
        ...h,
        n: settled.length,
        avgRet: settled.reduce((a, s) => a + s.avgRet, 0) / settled.length,
        avgAlpha: settled.reduce((a, s) => a + s.alpha, 0) / settled.length,
        beatRate: settled.filter((s) => s.alpha > 0).length / settled.length,
        winRate: allPicks.filter((p) => (p.ret ?? 0) > 0).length / Math.max(1, allPicks.length),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohorts]);
  const anySettled = settledAgg?.some((h) => h.n > 0) ?? false;

  const agg = useMemo(() => {
    if (!rows) return null;
    const scored = rows.filter((r) => r.alpha != null && r.ageDays >= 1);
    const allPicks = scored.flatMap((r) => r.pickRets.filter((p) => p.ret != null));
    if (scored.length === 0 || allPicks.length === 0) return null;
    return {
      cohorts: scored.length,
      picks: allPicks.length,
      winRate: allPicks.filter((p) => (p.ret ?? 0) > 0).length / allPicks.length,
      avgPickRet: allPicks.reduce((a, p) => a + (p.ret ?? 0), 0) / allPicks.length,
      avgAlpha: scored.reduce((a, r) => a + (r.alpha ?? 0), 0) / scored.length,
      beatRate: scored.filter((r) => (r.alpha ?? 0) > 0).length / scored.length,
    };
  }, [rows]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <h1>Track record</h1>
        <div className="muted small">
          Does the scanner's method actually work? Every trading day the top 5 "Strong setup" S&P 500 picks are recorded automatically
          with their entry prices. Each cohort then gets <b>frozen verdicts at fixed horizons</b> — 1 week, 1 month and 3 months of trading days —
          computed from closing prices against the S&P 500 over the identical window. Once settled, a verdict never changes.
          The record is immutable: entries are verified against live market data when written and can't be edited afterwards.
        </div>
      </div>

      {error && <EmptyState title="Couldn't load the track record" hint={error} />}

      {!error && rows && rows.length === 0 && (
        <EmptyState
          title="No cohorts recorded yet"
          hint="The first cohort is recorded automatically the first time the daily scan completes in live mode. Come back after the next market session."
        />
      )}

      {/* Settled verdicts — the accountable, frozen numbers */}
      {rows && rows.length > 0 && (
        <div className="card stack">
          <div className="card-title" style={{ marginBottom: 0 }}>
            <h2>Settled verdicts</h2>
            <Tooltip text="The accountable numbers. Each cohort's return is locked in at exactly 5, 21 and 63 trading days after entry, using closing prices, against the S&P 500 over the identical window — then frozen forever. Live 'since entry' numbers below keep moving; these don't." />
          </div>
          {anySettled ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Horizon</th><th>Cohorts</th><th>Avg picks</th><th>Edge vs S&P</th><th>Beat rate</th><th>Picks positive</th></tr>
                </thead>
                <tbody>
                  {settledAgg!.map((h) => (
                    <tr key={h.key} style={{ cursor: "default" }}>
                      <td style={{ fontWeight: 650 }}>{h.label}{h.key === "1m" && <span className="badge accent" style={{ marginLeft: 6 }}>headline</span>}</td>
                      {h.n === 0 ? (
                        <td colSpan={5} className="faint">No cohorts this old yet.</td>
                      ) : (
                        <>
                          <td className="mono">{h.n}</td>
                          <td className={classNames("mono", h.avgRet >= 0 ? "up" : "down")}>{fmtPct(h.avgRet * 100)}</td>
                          <td className={classNames("mono", h.avgAlpha >= 0 ? "up" : "down")} style={{ fontWeight: 700 }}>{fmtPct(h.avgAlpha * 100)}</td>
                          <td className="mono">{Math.round(h.beatRate * 100)}%</td>
                          <td className="mono">{Math.round(h.winRate * 100)}%</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              No verdicts have matured yet. The first <b>1-week</b> verdict locks in 5 trading days after the first cohort;
              <b> 1-month</b> after 21 trading days; <b>3-month</b> after 63. Verdicts settle automatically on the server —
              nothing to do but wait, and nobody can touch the numbers.
            </p>
          )}
        </div>
      )}

      {/* Aggregate scoreboard (live, still-moving numbers) */}
      {agg && (
        <div className="grid cols-4">
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 750 }} className="mono">{agg.cohorts}</div>
            <div className="faint">daily cohorts ({agg.picks} picks)</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 750 }} className={classNames("mono", agg.winRate >= 0.5 ? "up" : "down")}>{Math.round(agg.winRate * 100)}%</div>
            <div className="faint">picks positive <Tooltip text="Share of all recorded picks trading above their entry price today." /></div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 750 }} className={classNames("mono", agg.avgPickRet >= 0 ? "up" : "down")}>{fmtPct(agg.avgPickRet * 100)}</div>
            <div className="faint">avg pick return</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 750 }} className={classNames("mono", agg.avgAlpha >= 0 ? "up" : "down")}>{fmtPct(agg.avgAlpha * 100)}</div>
            <div className="faint">avg edge vs S&P 500 <Tooltip text="Average of (cohort return − S&P 500 return) over identical windows. Positive = the method beat simply buying the index. This is THE number that matters." /></div>
          </div>
        </div>
      )}
      {agg && (
        <div className="muted small">
          The method beat the S&P 500 in <b>{Math.round(agg.beatRate * 100)}%</b> of cohorts so far.
          {agg.cohorts < 20 && " Small sample — judge nothing before ~20 cohorts."}
        </div>
      )}

      {/* Cohorts */}
      {!rows && !error && <div className="stack"><Skeleton h={80} /><Skeleton h={80} /><Skeleton h={80} /></div>}
      {rows?.map((r) => (
        <div key={r.cohort.date} className="card pad-0">
          <div className="row between wrap" style={{ padding: "13px 16px 9px" }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <h2>{r.cohort.date}</h2>
              <span className="badge neutral">{r.ageDays === 0 ? "today" : `${r.ageDays}d ago`}</span>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {r.avgRet != null && (
                <span className={classNames("badge", r.avgRet >= 0 ? "up" : "down")}>live {fmtPct(r.avgRet * 100)}</span>
              )}
              {r.spxRet != null && <span className="badge outline">S&P {fmtPct(r.spxRet * 100)}</span>}
              {r.alpha != null && (
                <span className={classNames("badge", r.alpha >= 0 ? "up" : "down")} style={{ fontWeight: 700 }}>
                  {r.alpha >= 0 ? "beat" : "lagged"} by {fmtPct(Math.abs(r.alpha) * 100)}
                </span>
              )}
            </div>
          </div>
          {/* Frozen horizon verdicts for this cohort */}
          <div className="row wrap" style={{ gap: 6, padding: "0 16px 10px" }}>
            {HORIZONS.map((h) => {
              const s = r.cohort.settled?.[h.key];
              return s ? (
                <Tooltip key={h.key} text={`Locked ${h.days} after entry: picks ${fmtPct(s.avgRet * 100)} vs S&P ${fmtPct(s.spxRet * 100)} over the same window. This verdict is frozen — it will never change.`}>
                  <span className={classNames("badge", s.alpha >= 0 ? "up" : "down")} style={{ fontWeight: 700 }}>
                    {h.label}: {s.alpha >= 0 ? "beat" : "lagged"} {fmtPct(Math.abs(s.alpha) * 100)} 🔒
                  </span>
                </Tooltip>
              ) : (
                <span key={h.key} className="badge neutral">{h.label}: pending</span>
              );
            })}
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {r.pickRets.map((p) => (
              <div key={p.symbol} className="condition-row" style={{ alignItems: "center", padding: "8px 16px", cursor: "pointer" }} onClick={() => nav(`/stock/${p.symbol}`)}>
                <span className="ticker-link" style={{ minWidth: 52 }}>{p.symbol}</span>
                <span className="faint">score {p.score}</span>
                <span className="mono small" style={{ marginLeft: "auto" }}>
                  {fmtPrice(p.entry)} → {p.now != null ? fmtPrice(p.now) : "…"}
                </span>
                {p.ret != null && (
                  <span className={classNames("mono small", p.ret >= 0 ? "up" : "down")} style={{ fontWeight: 700, minWidth: 62, textAlign: "right" }}>
                    {fmtPct(p.ret * 100)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
        <span className="small">
          <b>What this is:</b> a paper benchmark of the scanner's own signals — equal-weight entries at scan-time prices, exits scored at fixed
          1-week / 1-month / 3-month horizons using closing prices, no fees or slippage. It exists to honestly test whether the method has an edge,
          not to prove it does. Short histories mean nothing; and even a real historical edge is <b>not</b> a prediction or investment advice.
        </span>
      </div>
    </div>
  );
}
