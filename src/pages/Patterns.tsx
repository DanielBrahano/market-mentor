import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ScanResult } from "../lib/types";
import { scanUniverse } from "../lib/scanner/engine";
import { CANDLE_DOCS, PATTERN_DOCS } from "../content/education";
import { classNames } from "../lib/utils";
import { useStore } from "../state/store";
import { ConfidenceBadge, EmptyState, Seg, SkeletonCard, Tooltip } from "../components/ui";
import { CandleShapes, MiniCandles } from "../components/charts/Sparkline";

/** Illustrative SVG sketch for each chart pattern (idealized shape). */
function PatternSketch({ kind }: { kind: string }) {
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
    <svg viewBox="0 0 97 74" width="150" height="110" style={{ display: "block", background: "var(--bg-input)", borderRadius: 8 }}>
      {p.extra}
      <path d={p.d} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Patterns() {
  const [tab, setTab] = useState<"chart" | "candles" | "live">("chart");
  const [scan, setScan] = useState<ScanResult[] | null>(null);
  const { settings } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    if (tab !== "live" || scan) return;
    let dead = false;
    scanUniverse().then((r) => !dead && setScan(r));
    return () => { dead = true; };
  }, [tab, scan]);

  const liveHits = useMemo(
    () => scan?.filter((r) => r.patterns.length > 0).sort((a, b) => b.patterns[0].confidence - a.patterns[0].confidence) ?? null,
    [scan]
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <h1>Pattern Explorer</h1>
        <div className="muted small">
          {settings.beginnerMode
            ? "Patterns are recurring price shapes created by crowd psychology. Learn what each one looks like, why it forms, and how our engine detects it — then see live detections."
            : "Pattern reference, detection methodology, and live detections across the universe."}
        </div>
      </div>

      <Seg
        options={[{ value: "chart", label: "Chart patterns" }, { value: "candles", label: "Candlesticks" }, { value: "live", label: "Live detections" }] as const}
        value={tab} onChange={setTab}
      />

      <div className="card" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
        <span className="small">
          <b>Honesty first:</b> pattern recognition is probabilistic. Even textbook-perfect patterns fail regularly — studies typically put individual pattern success rates between 50–70% depending on market conditions.
          Confidence scores measure how cleanly a shape matches the rules, <b>not</b> the odds of profit. Use patterns as a reason to investigate, never as a signal to act blindly.
        </span>
      </div>

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

      {tab === "live" && (
        <>
          {!liveHits && <div className="grid cols-2"><SkeletonCard lines={4} /><SkeletonCard lines={4} /></div>}
          {liveHits && liveHits.length === 0 && (
            <EmptyState title="No patterns detected right now" hint="Clean patterns are genuinely rare — the engine rechecks the whole universe as data updates." />
          )}
          {liveHits && liveHits.length > 0 && (
            <div className="grid cols-2">
              {liveHits.map((r) => (
                <div key={r.symbol} className="card" style={{ cursor: "pointer" }} onClick={() => nav(`/stock/${r.symbol}`)}>
                  <div className="row between">
                    <div>
                      <span className="ticker-link" style={{ fontSize: 15 }}>{r.symbol}</span>
                      <span className="faint" style={{ marginLeft: 8 }}>{r.name}</span>
                    </div>
                    <ConfidenceBadge confidence={r.patterns[0].confidence} />
                  </div>
                  <div style={{ margin: "10px 0" }}><MiniCandles candles={r.candles60} width={420} height={80} /></div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {r.patterns.map((p) => (
                      <span key={p.kind} className="badge accent">{p.label} · {Math.round(p.confidence * 100)}%</span>
                    ))}
                  </div>
                  <p className="small muted" style={{ margin: "8px 0 0" }}>{r.patterns[0].explanation}</p>
                  <p className="faint" style={{ margin: "6px 0 0" }}>Open the stock page to annotate this pattern on the full chart <Tooltip text="On the stock page, click the pattern in the 'Detected patterns' card to see its key points (peaks, necklines, rims) marked on the price chart." /></p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
