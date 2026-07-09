import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ScanResult, ScanSnapshot } from "../lib/types";
import { scanUniverse } from "../lib/scanner/engine";
import { CANDLE_DOCS, PATTERN_DOCS } from "../content/education";
import { classNames, fmtPct, fmtPrice } from "../lib/utils";
import { useStore } from "../state/store";
import { ConfidenceBadge, EmptyState, Seg, Tooltip } from "../components/ui";
import { ScanProgress } from "../components/ScanProgress";
import { CandleShapes, MiniCandles } from "../components/charts/Sparkline";

/** Illustrative SVG sketch for each chart pattern (idealized shape). */
function PatternSketch({ kind, size = 150 }: { kind: string; size?: number }) {
  const paths: Record<string, { d: string; extra?: React.ReactNode }> = {
    "head-and-shoulders": { d: "M5,60 L20,35 L32,48 L48,18 L64,48 L76,35 L92,62", extra: <line x1="26" y1="48" x2="72" y2="48" stroke="var(--purple)" strokeDasharray="3 3" strokeWidth="1.5" /> },
    "inverse-head-and-shoulders": { d: "M5,20 L20,45 L32,32 L48,62 L64,32 L76,45 L92,16", extra: <line x1="26" y1="32" x2="72" y2="32" stroke="var(--purple)" strokeDasharray="3 3" strokeWidth="1.5" /> },
    "double-top": { d: "M5,62 L28,20 L48,44 L68,20 L92,64", extra: <line x1="30" y1="44" x2="88" y2="44" stroke="var(--purple)" strokeDasharray="3 3" strokeWidth="1.5" /> },
    "double-bottom": { d: "M5,18 L28,60 L48,36 L68,60 L92,14", extra: <line x1="30" y1="36" x2="88" y2="36" stroke="var(--purple)" strokeDasharray="3 3" strokeWidth="1.5" /> },
    "ascending-triangle": { d: "M5,62 L22,28 L36,52 L52,28 L64,40 L78,28 L92,20", extra: <><line x1="18" y1="28" x2="82" y2="28" stroke="var(--purple)" strokeWidth="1.5" /><line x1="5" y1="62" x2="78" y2="30" stroke="var(--teal)" strokeWidth="1.5" strokeDasharray="3 3" /></> },
    "descending-triangle": { d: "M5,18 L22,52 L36,30 L52,52 L64,42 L78,52 L92,62", extra: <><line x1="18" y1="52" x2="82" y2="52" stroke="var(--purple)" strokeWidth="1.5" /><line x1="5" y1="18" x2="78" y2="50" stroke="var(--teal)" strokeWidth="1.5" strokeDasharray="3 3" /></> },
    "bull-flag": { d: "M5,66 L38,16 L48,24 L56,20 L64,28 L72,24 L92,8", extra: <rect x="44" y="14" width="32" height="18" fill="none" stroke="var(--purple)" strokeDasharray="3 3" rx="2" /> },
    "bear-flag": { d: "M5,8 L38,58 L48,50 L56,54 L64,46 L72,50 L92,68", extra: <rect x="44" y="42" width="32" height="18" fill="none" stroke="var(--purple)" strokeDasharray="3 3" rx="2" /> },
    "cup-and-handle": { d: "M8,22 C20,58 46,60 62,28 L70,26 L76,36 L84,32 L92,16", extra: <line x1="8" y1="24" x2="66" y2="24" stroke="var(--purple)" strokeDasharray="3 3" strokeWidth="1.5" /> },
    rectangle: { d: "M5,50 L18,26 L32,50 L46,26 L60,50 L74,26 L88,44", extra: <><line x1="10" y1="26" x2="90" y2="26" stroke="var(--purple)" strokeWidth="1.5" strokeDasharray="3 3" /><line x1="10" y1="50" x2="90" y2="50" stroke="var(--purple)" strokeWidth="1.5" strokeDasharray="3 3" /></> },
  };
  const p = paths[kind];
  if (!p) return null;
  return (
    <svg viewBox="0 0 97 74" width={size} height={Math.round(size * 0.73)} style={{ display: "block", background: "var(--bg-input)", borderRadius: 8, flexShrink: 0 }}>
      {p.extra}
      <path d={p.d} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Leaderboard: for each pattern, the top companies currently showing it. */
function PatternLeaderboard({ snap }: { snap: ScanSnapshot }) {
  const nav = useNavigate();

  const groups = useMemo(() => {
    return PATTERN_DOCS.map((doc) => {
      const hits = snap.results
        .map((r) => {
          const hit = r.patterns.find((p) => p.kind === doc.kind);
          return hit ? { result: r, hit } : null;
        })
        .filter((x): x is { result: ScanResult; hit: ScanResult["patterns"][number] } => x !== null)
        .sort((a, b) => b.hit.confidence - a.hit.confidence)
        .slice(0, 5);
      return { doc, hits };
    }).sort((a, b) => b.hits.length - a.hits.length);
  }, [snap]);

  const totalHits = groups.reduce((n, g) => n + g.hits.length, 0);
  if (totalHits === 0) {
    return <EmptyState title="No patterns detected right now" hint="Clean patterns are genuinely rare — the engine rechecks the whole market as data updates." />;
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="muted small" style={{ margin: 0 }}>
        The strongest current matches for each pattern across all {snap.universeSize.toLocaleString()} scanned stocks, ranked by detection confidence.
        Confidence measures how cleanly the shape fits the rules — <b>not</b> the odds of profit.
      </p>
      {groups.map(({ doc, hits }) => (
        <div key={doc.kind} className="card pad-0">
          <div className="row wrap" style={{ padding: "14px 16px 10px", gap: 12 }}>
            <PatternSketch kind={doc.kind} size={84} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <h2>{doc.name}</h2>
                <span className={classNames("badge", doc.bias === "bullish" ? "up" : doc.bias === "bearish" ? "down" : "neutral")}>{doc.bias}</span>
                <span className="badge neutral">{hits.length ? `top ${hits.length}` : "0 found"}</span>
                <Tooltip text={doc.what} />
              </div>
              <div className="faint" style={{ marginTop: 2 }}>{doc.psychology}</div>
            </div>
          </div>
          {hits.length === 0 ? (
            <div className="faint" style={{ padding: "0 16px 14px" }}>No stock currently matches this pattern cleanly — that's normal, patterns come and go.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>#</th><th>Symbol</th><th>Price</th><th>Today</th><th>Confidence</th><th className="hide-sm">Sector</th><th className="hide-sm">Chart (60d)</th></tr>
                </thead>
                <tbody>
                  {hits.map(({ result: r, hit }, i) => (
                    <tr key={r.symbol} onClick={() => nav(`/stock/${r.symbol}`)}>
                      <td className="mono faint">{i + 1}</td>
                      <td><span className="ticker-link">{r.symbol}</span><div className="faint">{r.name}</div></td>
                      <td className="mono">{fmtPrice(r.price)}</td>
                      <td className={classNames("mono", r.changePct >= 0 ? "up" : "down")}>{fmtPct(r.changePct)}</td>
                      <td><ConfidenceBadge confidence={hit.confidence} /></td>
                      <td className="faint hide-sm">{r.sector}</td>
                      <td className="hide-sm"><MiniCandles candles={r.candles60.slice(-45)} width={130} height={36} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Patterns() {
  const [tab, setTab] = useState<"top" | "chart" | "candles">("top");
  const [snap, setSnap] = useState<ScanSnapshot | null>(null);
  const { settings } = useStore();

  useEffect(() => {
    let dead = false;
    scanUniverse().then((s) => !dead && setSnap(s));
    return () => { dead = true; };
  }, []);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <h1>Pattern Explorer</h1>
        <div className="muted small">
          {settings.beginnerMode
            ? "Patterns are recurring price shapes created by crowd psychology. See which companies show each pattern right now, and learn what every pattern means."
            : "Per-pattern leaderboards across the scanned universe, plus the pattern reference."}
        </div>
      </div>

      <Seg
        options={[{ value: "top", label: "Top stocks by pattern" }, { value: "chart", label: "Chart patterns guide" }, { value: "candles", label: "Candlesticks guide" }] as const}
        value={tab} onChange={setTab}
      />

      <div className="card" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
        <span className="small">
          <b>Honesty first:</b> pattern recognition is probabilistic. Even textbook-perfect patterns fail regularly — studies typically put individual pattern success rates between 50–70% depending on market conditions.
          Confidence scores measure how cleanly a shape matches the rules, <b>not</b> the odds of profit. Use patterns as a reason to investigate, never as a signal to act blindly.
        </span>
      </div>

      {tab === "top" && (snap ? <PatternLeaderboard snap={snap} /> : <ScanProgress label="Scanning the market for patterns" />)}

      {tab === "chart" && (
        <div className="grid cols-2">
          {PATTERN_DOCS.map((p) => (
            <div key={p.kind} className="card">
              <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                <PatternSketch kind={p.kind} />
                <div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <h3>{p.name}</h3>
                    <span className={classNames("badge", p.bias === "bullish" ? "up" : p.bias === "bearish" ? "down" : "neutral")}>{p.bias}</span>
                  </div>
                  <p className="small muted" style={{ margin: "6px 0 0" }}>{p.what}</p>
                </div>
              </div>
              <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                <div className="small"><b>Why it forms:</b> <span className="muted">{p.psychology}</span></div>
                <div className="small"><b>How we detect it:</b> <span className="muted">{p.detection}</span></div>
                <div className="small"><b>False signals to expect:</b> <span className="muted">{p.falseSignals}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "candles" && (
        <div className="grid cols-2">
          {CANDLE_DOCS.map((c) => (
            <div key={c.kind} className="card">
              <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                <div style={{ background: "var(--bg-input)", borderRadius: 8, padding: "6px 10px" }}>
                  <CandleShapes shapes={c.shape} width={c.shape.length * 44} height={92} />
                </div>
                <div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <h3>{c.name}</h3>
                    <span className={classNames("badge", c.bias === "bullish" ? "up" : c.bias === "bearish" ? "down" : "neutral")}>{c.bias}</span>
                  </div>
                  <p className="small muted" style={{ margin: "6px 0 0" }}>{c.what}</p>
                </div>
              </div>
              <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                <div className="small"><b>Where context matters:</b> <span className="muted">{c.context}</span></div>
                <div className="small" style={{ color: "var(--warn)" }}><b>⚠ Don't over-trust it:</b> <span className="muted">{c.warning}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
