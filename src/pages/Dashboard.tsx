import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { IndexSummary, ScanSnapshot } from "../lib/types";
import { provider } from "../lib/data/provider";
import { scanUniverse, scoreBand } from "../lib/scanner/engine";
import { fmtPct, fmtPrice, fmtTimeAgo, classNames } from "../lib/utils";
import { useStore } from "../state/store";
import { Sparkline, MiniCandles } from "../components/charts/Sparkline";
import { ConfidenceBadge, EmptyState, ScoreBar, Skeleton, SkeletonCard, Tooltip } from "../components/ui";
import { ScanProgress } from "../components/ScanProgress";
import { IconBell, IconTrendUp } from "../components/icons";

export default function Dashboard() {
  const [indexes, setIndexes] = useState<IndexSummary[] | null>(null);
  const [snap, setSnap] = useState<ScanSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { alerts, settings } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    let dead = false;
    provider().getIndexSummaries().then((ix) => !dead && setIndexes(ix)).catch(() => {});
    scanUniverse()
      .then((s) => !dead && setSnap(s))
      .catch((e) => !dead && setError(e instanceof Error ? e.message : "Failed to scan market"));
    return () => { dead = true; };
  }, []);

  const topHits = useMemo(() => snap?.results.slice(0, 5) ?? null, [snap]);
  const interesting = useMemo(
    () => snap?.results.filter((r) => r.patterns.length > 0).slice(0, 3) ?? null,
    [snap]
  );
  const movers = useMemo(
    () => (snap ? [...snap.results].sort((a, b) => b.changePct - a.changePct).slice(0, 5) : null),
    [snap]
  );
  const breadth = snap?.breadth ?? null;
  const recentAlerts = alerts.slice(0, 5);

  if (error) return <EmptyState title="Couldn't load market data" hint={error} />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {settings.displayName}</h1>
          <div className="muted small">
            {settings.beginnerMode
              ? "Here's what the market is doing and which stocks our scanner finds interesting today — with plain-English reasons."
              : "Market overview, breadth and top scanner candidates."}
            {snap && <> Scanned <b>{snap.universeSize.toLocaleString()}</b> stocks (S&P 500 + Russell 2000).</>}
          </div>
        </div>
        <Link to="/screener" className="btn primary">Open Screener</Link>
      </div>

      {/* Index cards */}
      <div className="grid cols-4">
        {indexes
          ? indexes.map((ix) => (
              <div className="card" key={ix.id}>
                <div className="row between">
                  <span className="muted small" style={{ fontWeight: 650 }}>{ix.name}</span>
                  <span className={classNames("badge", ix.changePct >= 0 ? "up" : "down", "mono")}>{fmtPct(ix.changePct)}</span>
                </div>
                <div className="row between" style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 21, fontWeight: 700 }} className="mono">{fmtPrice(ix.value)}</span>
                  <Sparkline values={ix.spark} />
                </div>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
      </div>

      {!snap && <ScanProgress />}

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <div className="stack" style={{ gap: 16 }}>
          {/* Top scanner hits */}
          <div className="card pad-0">
            <div className="card-title" style={{ padding: "14px 16px 0" }}>
              <h2>Top scanner hits</h2>
              <Tooltip text="Every stock in the S&P 500 and Russell 2000 is checked against 11 transparent bullish conditions (trend, momentum, volume, breakouts). The score is simply the sum of the points for each condition that's true — click any stock to see the full checklist." />
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Symbol</th><th>Price</th><th>Today</th><th>Setup score</th><th>Why it's interesting</th><th></th></tr>
                </thead>
                <tbody>
                  {topHits ? topHits.map((r) => {
                    const band = scoreBand(r.score, r.maxScore);
                    return (
                      <tr key={r.symbol} onClick={() => nav(`/stock/${r.symbol}`)}>
                        <td><span className="ticker-link">{r.symbol}</span><div className="faint">{r.name}</div></td>
                        <td className="mono">{fmtPrice(r.price)}</td>
                        <td className={classNames("mono", r.changePct >= 0 ? "up" : "down")}>{fmtPct(r.changePct)}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <ScoreBar score={r.score} max={r.maxScore} />
                            <span className="mono small">{r.score}</span>
                          </div>
                          <span className={classNames("badge", band.tone === "strong" ? "up" : band.tone === "moderate" ? "warn" : "neutral")} style={{ marginTop: 4 }}>{band.label}</span>
                        </td>
                        <td style={{ whiteSpace: "normal", maxWidth: 260 }} className="small muted">{r.summary}</td>
                        <td><MiniCandles candles={r.candles60.slice(-30)} /></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={6}><div className="stack" style={{ padding: 10 }}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Why interesting cards */}
          <div>
            <div className="card-title"><h2>Why these stocks are interesting</h2>
              <Tooltip text="These stocks currently show a detected chart pattern on top of their scanner conditions. Pattern detection is probabilistic — a percentage tells you how cleanly it matches, never a guarantee." />
            </div>
            <div className="grid cols-3">
              {interesting ? interesting.length ? interesting.map((r) => (
                <div className="card stack" key={r.symbol} style={{ cursor: "pointer" }} onClick={() => nav(`/stock/${r.symbol}`)}>
                  <div className="row between">
                    <span className="ticker-link" style={{ fontSize: 15 }}>{r.symbol}</span>
                    <ConfidenceBadge confidence={r.patterns[0].confidence} />
                  </div>
                  <MiniCandles candles={r.candles60} width={230} height={56} />
                  <div>
                    <span className="badge accent">{r.patterns[0].label}</span>
                    <span className="badge neutral" style={{ marginLeft: 6 }}>{r.sector}</span>
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>{r.patterns[0].explanation}</p>
                </div>
              )) : <EmptyState title="No high-confidence patterns right now" hint="The pattern engine rechecks the whole universe throughout the day." /> : (
                <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              )}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {/* Breadth */}
          <div className="card">
            <div className="card-title">
              <h2>Market breadth</h2>
              <Tooltip text="Breadth measures how many stocks are participating in a move. Lots of advancers and stocks above their moving averages = broad, healthy strength. A rising index with weak breadth is being carried by only a few big names." />
            </div>
            {breadth ? (
              <div className="stack">
                <div className="row between small">
                  <span className="muted">Advancers vs decliners</span>
                  <span className="mono"><span className="up">{breadth.advancers.toLocaleString()}</span> / <span className="down">{breadth.decliners.toLocaleString()}</span></span>
                </div>
                <div className="scorebar">
                  <div style={{ width: `${(breadth.advancers / (breadth.advancers + breadth.decliners || 1)) * 100}%`, background: "var(--up)" }} />
                </div>
                <div className="row between small"><span className="muted">Above 50-day average <Tooltip text="Percent of scanned stocks trading above their own 50-day moving average — a medium-term health check." /></span><span className="mono">{breadth.pctAbove50ma.toFixed(0)}%</span></div>
                <div className="row between small"><span className="muted">Above 200-day average</span><span className="mono">{breadth.pctAbove200ma.toFixed(0)}%</span></div>
                <div className="row between small"><span className="muted">Near 52-week highs / lows</span><span className="mono"><span className="up">{breadth.newHighs}</span> / <span className="down">{breadth.newLows}</span></span></div>
                <p className="faint" style={{ margin: 0 }}>
                  {breadth.pctAbove50ma > 60 ? "Broad participation — most stocks are trending up. Momentum setups tend to work better in this environment." :
                   breadth.pctAbove50ma > 40 ? "Mixed market — some sectors are working, others aren't. Be selective." :
                   "Weak breadth — most stocks are below their averages. Bullish setups fail more often in this environment; smaller position sizes make sense."}
                </p>
              </div>
            ) : <div className="stack"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>}
          </div>

          {/* Recent alerts */}
          <div className="card">
            <div className="card-title">
              <h2>Recent alerts</h2>
              <Link to="/alerts" className="small">View all</Link>
            </div>
            {recentAlerts.length === 0 ? (
              <EmptyState title="No alerts yet" hint="Alerts appear when stocks on your watchlist trigger your rules — like crossing a key moving average or printing a bullish pattern." action={<Link className="btn sm" to="/alerts">Set up alerts</Link>} />
            ) : (
              <div className="stack" style={{ gap: 0 }}>
                {recentAlerts.map((a) => (
                  <div key={a.id} className="condition-row" style={{ cursor: "pointer" }} onClick={() => nav(`/stock/${a.symbol}`)}>
                    <IconBell className="icon" style={{ width: 16, height: 16, color: a.read ? "var(--text-faint)" : "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div className="small" style={{ fontWeight: 650 }}>{a.title}</div>
                      <div className="faint">{a.body}</div>
                      <div className="faint">{fmtTimeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Momentum leaders */}
          <div className="card">
            <div className="card-title">
              <h2><IconTrendUp className="icon" style={{ width: 16, height: 16, verticalAlign: -3 }} /> Momentum today</h2>
            </div>
            {movers ? (
              <div className="stack" style={{ gap: 6 }}>
                {movers.map((r) => (
                  <div key={r.symbol} className="row between small" style={{ cursor: "pointer" }} onClick={() => nav(`/stock/${r.symbol}`)}>
                    <span><b>{r.symbol}</b> <span className="faint">{r.sector}</span></span>
                    <span className={classNames("mono", r.changePct >= 0 ? "up" : "down")}>{fmtPct(r.changePct)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="stack"><Skeleton /><Skeleton /><Skeleton /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
