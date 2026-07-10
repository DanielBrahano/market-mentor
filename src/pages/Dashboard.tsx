import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { IndexSummary, ScanResult, ScanSnapshot } from "../lib/types";
import { provider } from "../lib/data/provider";
import { scanUniverse, scoreBand } from "../lib/scanner/engine";
import { fmtPct, fmtPrice, fmtTimeAgo, classNames } from "../lib/utils";
import { useStore } from "../state/store";
import { Sparkline, MiniCandles } from "../components/charts/Sparkline";
import { ConfidenceBadge, Drawer, EmptyState, ExtHours, ScoreBar, Skeleton, SkeletonCard, Tooltip } from "../components/ui";
import { ScanProgress } from "../components/ScanProgress";
import { IconBell, IconInfo, IconTrendUp } from "../components/icons";
import { useFreshQuotes } from "../lib/useFreshQuotes";
import { useIsMobile } from "../lib/useIsMobile";
import { StockRowCard } from "../components/StockRowCard";

/** Plain-English explainers for each index, shown in the info drawer. */
const INDEX_INFO: Record<string, { tracks: string; weighting: string; readIt: string }> = {
  spx: {
    tracks: "The 500 largest publicly traded U.S. companies — about 80% of the entire U.S. stock market's value. When people say \"the market\" or \"stocks\", this is usually what they mean.",
    weighting: "Weighted by company size, so the biggest names (Apple, Microsoft, Nvidia) move it far more than smaller members.",
    readIt: "The broadest single gauge of how U.S. large-caps are doing. A green day here means large-cap America broadly rose.",
  },
  ndx: {
    tracks: "The Nasdaq Composite — every company listed on the Nasdaq exchange (roughly 3,000), which skews heavily toward technology and growth companies.",
    weighting: "Size-weighted and very tech-heavy, so it swings more than the S&P 500 and is treated as the pulse of tech.",
    readIt: "When tech and growth stocks are hot, this outpaces the S&P 500; when they sell off, it falls harder.",
  },
  rut: {
    tracks: "The Russell 2000 — about 2,000 small U.S. companies. It's the standard gauge for smaller, more domestic businesses.",
    weighting: "Size-weighted within the small-cap slice of the market.",
    readIt: "Small caps are more sensitive to the economy and interest rates. Strength here often signals broad risk appetite, not just a few giants carrying the market.",
  },
  dji: {
    tracks: "The Dow Jones Industrial Average — just 30 large, well-established \"blue-chip\" American companies. The oldest and most famous index.",
    weighting: "Unusually, it's price-weighted: a higher share price gives a stock more sway, regardless of company size. That's a historical quirk, not a better method.",
    readIt: "A quick read on how a handful of iconic large companies did. Narrower than the S&P 500, so treat it as a headline, not the whole story.",
  },
};

export default function Dashboard() {
  const [indexes, setIndexes] = useState<IndexSummary[] | null>(null);
  const [snap, setSnap] = useState<ScanSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<IndexSummary | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [welcomed, setWelcomed] = useState(() => localStorage.getItem("mm:welcomed") === "1");
  const { alerts, settings } = useStore();
  const nav = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    let dead = false;
    provider().getIndexSummaries().then((ix) => !dead && setIndexes(ix)).catch(() => {});
    scanUniverse()
      .then((s) => !dead && setSnap(s))
      .catch((e) => !dead && setError(e instanceof Error ? e.message : "Failed to scan market"));
    return () => { dead = true; };
  }, []);

  const rescan = async () => {
    setRescanning(true);
    try {
      const s = await scanUniverse(true, snap?.deep ?? false);
      setSnap(s);
      const ix = await provider().getIndexSummaries();
      setIndexes(ix);
    } catch { /* keep the current snapshot */ } finally {
      setRescanning(false);
    }
  };

  const dismissWelcome = () => { localStorage.setItem("mm:welcomed", "1"); setWelcomed(true); };

  const topHits = useMemo(() => snap?.results.slice(0, 5) ?? null, [snap]);
  const interesting = useMemo(
    () => snap?.results.filter((r) => r.patterns.length > 0).slice(0, 3) ?? null,
    [snap]
  );
  const gainers = useMemo(
    () => (snap ? [...snap.results].sort((a, b) => b.changePct - a.changePct).slice(0, 5) : null),
    [snap]
  );
  const losers = useMemo(
    () => (snap ? [...snap.results].sort((a, b) => a.changePct - b.changePct).slice(0, 5) : null),
    [snap]
  );
  const breadth = snap?.breadth ?? null;
  const recentAlerts = alerts.slice(0, 5);

  // Live quotes for everything visible on this page (scan prices go stale).
  const visibleSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const list of [topHits, gainers, losers, interesting]) list?.forEach((r) => set.add(r.symbol));
    return [...set];
  }, [topHits, gainers, losers, interesting]);
  const fresh = useFreshQuotes(visibleSymbols);
  const livePrice = (r: ScanResult) => fresh.get(r.symbol)?.price ?? r.price;
  const liveChange = (r: ScanResult) => fresh.get(r.symbol)?.changePct ?? r.changePct;
  const ext = (r: ScanResult) => {
    const q = fresh.get(r.symbol) ?? r;
    return <ExtHours state={q.marketState} price={q.extendedPrice} changePct={q.extendedChangePct} />;
  };
  const marketState = indexes?.[0]?.marketState;
  const MARKET_STATE_LABEL: Record<string, { label: string; color: string }> = {
    PRE: { label: "Pre-market", color: "var(--warn)" },
    REGULAR: { label: "Market open", color: "var(--up)" },
    POST: { label: "After hours", color: "var(--warn)" },
    CLOSED: { label: "Market closed", color: "var(--text-faint)" },
  };

  if (error) return <EmptyState title="Couldn't load market data" hint={error} />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <div className="row wrap" style={{ gap: 10 }}>
            <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {settings.displayName}</h1>
            {marketState && MARKET_STATE_LABEL[marketState] && (
              <span className="badge outline" style={{ alignSelf: "center" }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 99, background: MARKET_STATE_LABEL[marketState].color, marginRight: 6 }} />
                {MARKET_STATE_LABEL[marketState].label}
              </span>
            )}
          </div>
          <div className="muted small">
            {settings.beginnerMode
              ? "Here's what the market is doing and which stocks our scanner finds interesting today — with plain-English reasons."
              : "Market overview, breadth and top scanner candidates."}
            {snap && (
              <>
                {" "}Scanned <b>{snap.universeSize.toLocaleString()}</b> stocks · updated {fmtTimeAgo(snap.at)}{" "}
                <button className="btn ghost sm" onClick={rescan} disabled={rescanning} style={{ verticalAlign: "baseline" }}>
                  {rescanning ? "Rescanning…" : "Rescan now"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="row wrap">
          <Link to="/track-record" className="btn">📈 Track record</Link>
          <Link to="/screener" className="btn primary">Open Screener</Link>
        </div>
      </div>

      {!welcomed && (
        <div className="card" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
          <div className="row between wrap" style={{ alignItems: "flex-start" }}>
            <div style={{ maxWidth: 640 }}>
              <h2 style={{ marginBottom: 6 }}>Welcome to Market Mentor 👋</h2>
              <p className="small muted" style={{ margin: 0 }}>
                Real market prices, a transparent setup scanner, and plain-English explanations for everything.
                The daily habit: <b>1)</b> check the market's mood here, <b>2)</b> find candidates in the Screener or Pattern Explorer,
                <b> 3)</b> click into a stock and read <i>why</i> it scored what it did. Hover any <span className="tip-icon" style={{ display: "inline-flex" }}>?</span> to learn a term.
                This is educational software — never financial advice.
              </p>
            </div>
            <div className="row" style={{ flexShrink: 0 }}>
              <Link className="btn sm" to="/learn" onClick={dismissWelcome}>Start with the basics</Link>
              <button className="btn primary sm" onClick={dismissWelcome}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Index cards — click for a plain-English explainer */}
      <div className="grid cols-4">
        {indexes
          ? indexes.map((ix) => (
              <div
                className={classNames("card index-card", ix.changePct > 0.001 ? "gain" : ix.changePct < -0.001 ? "lose" : undefined)}
                key={ix.id}
                onClick={() => setOpenIndex(ix)}
                style={{ cursor: "pointer" }}
                title={`What is the ${ix.name}?`}
              >
                <div className="row between">
                  <span className="muted small" style={{ fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {ix.name}
                    <IconInfo className="icon" style={{ width: 13, height: 13, color: "var(--text-faint)" }} />
                  </span>
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

      {openIndex && (
        <Drawer title={openIndex.name} onClose={() => setOpenIndex(null)}>
          <div className="stack" style={{ gap: 14 }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="row between">
                <span style={{ fontSize: 26, fontWeight: 750 }} className="mono">{fmtPrice(openIndex.value)}</span>
                <span className={classNames("badge", openIndex.changePct >= 0 ? "up" : "down", "mono")}>
                  {openIndex.change >= 0 ? "+" : ""}{fmtPrice(openIndex.change)} ({fmtPct(openIndex.changePct)})
                </span>
              </div>
              <div className="row" style={{ marginTop: 8 }}><Sparkline values={openIndex.spark} width={260} height={54} /></div>
              <div className="faint" style={{ marginTop: 6 }}>Last month of daily closes · change shown vs the previous session.</div>
            </div>
            {INDEX_INFO[openIndex.id] && (
              <>
                <div>
                  <h3 style={{ marginBottom: 6 }}>What it tracks</h3>
                  <p className="small muted" style={{ margin: 0 }}>{INDEX_INFO[openIndex.id].tracks}</p>
                </div>
                <div>
                  <h3 style={{ marginBottom: 6 }}>How it's built</h3>
                  <p className="small muted" style={{ margin: 0 }}>{INDEX_INFO[openIndex.id].weighting}</p>
                </div>
                <div>
                  <h3 style={{ marginBottom: 6 }}>How to read today's move</h3>
                  <p className="small muted" style={{ margin: 0 }}>{INDEX_INFO[openIndex.id].readIt}</p>
                </div>
              </>
            )}
            <div className="card" style={{ margin: 0, background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
              <span className="small">An index is an average, not something you buy directly. It tells you the market's mood — individual stocks can move very differently on the same day.</span>
            </div>
          </div>
        </Drawer>
      )}

      {!snap && <ScanProgress />}

      <div className="grid main-split">
        <div className="stack" style={{ gap: 16 }}>
          {/* Top scanner hits */}
          {isMobile ? (
            <div>
              <div className="card-title">
                <h2>Top scanner hits</h2>
                <Tooltip text="Every scanned stock is checked against 11 transparent bullish conditions. The score is the sum of points for each condition that's true — tap a stock for the full checklist." />
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {topHits
                  ? topHits.map((r) => (
                      <StockRowCard key={r.symbol} r={r} quote={fresh.get(r.symbol)} onOpen={() => nav(`/stock/${r.symbol}`)} showSummary />
                    ))
                  : <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
              </div>
            </div>
          ) : (
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
                        <td className="mono">
                          {fmtPrice(livePrice(r))}
                          <div>{ext(r)}</div>
                        </td>
                        <td className={classNames("mono", liveChange(r) >= 0 ? "up" : "down")}>{fmtPct(liveChange(r))}</td>
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
          )}

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

          {/* Top gainers & losers */}
          <div className="card">
            <div className="card-title">
              <h2><IconTrendUp className="icon" style={{ width: 16, height: 16, verticalAlign: -3 }} /> Gainers & losers</h2>
              <Tooltip text="The biggest movers of the day across all scanned stocks. Big moves usually have a news reason — always check why before reading anything into it." />
            </div>
            {gainers && losers ? (
              <div className="grid cols-2" style={{ gap: 12 }}>
                <div className="stack" style={{ gap: 6 }}>
                  <div className="faint" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Top gainers</div>
                  {gainers.map((r) => (
                    <div key={r.symbol} className="row between small" style={{ cursor: "pointer" }} onClick={() => nav(`/stock/${r.symbol}`)}>
                      <span><b>{r.symbol}</b> {ext(r)}</span>
                      <span className={classNames("mono", liveChange(r) >= 0 ? "up" : "down")}>{fmtPct(liveChange(r))}</span>
                    </div>
                  ))}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <div className="faint" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Top losers</div>
                  {losers.map((r) => (
                    <div key={r.symbol} className="row between small" style={{ cursor: "pointer" }} onClick={() => nav(`/stock/${r.symbol}`)}>
                      <span><b>{r.symbol}</b> {ext(r)}</span>
                      <span className={classNames("mono", liveChange(r) >= 0 ? "up" : "down")}>{fmtPct(liveChange(r))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="stack"><Skeleton /><Skeleton /><Skeleton /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
