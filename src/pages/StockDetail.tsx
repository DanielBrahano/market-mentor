import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Candle, CompanyInfo, PatternHit, Quote, Timeframe } from "../lib/types";
import { provider } from "../lib/data/provider";
import { computeBundle, slopePctPerDay, vwap, type IndicatorBundle } from "../lib/indicators/core";
import { ensureBenchmark, evaluateSymbol } from "../lib/scanner/engine";
import { detectRecentCandlePatterns } from "../lib/patterns/candlesticks";
import { classNames, fmtBig, fmtChange, fmtPct, fmtPrice, fmtVolume } from "../lib/utils";
import { useStore } from "../state/store";
import { PriceChart, type OverlayLine } from "../components/charts/PriceChart";
import { IndicatorPanel } from "../components/charts/IndicatorPanel";
import { ConfidenceBadge, DataSourceBadge, Drawer, EmptyState, Seg, Skeleton, SkeletonCard, Switch, Tooltip } from "../components/ui";
import { IconShare, IconStar } from "../components/icons";

const TIMEFRAMES: Timeframe[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];

const OVERLAY_DEFS = [
  { id: "sma20", label: "SMA 20", color: "#60a5fa" },
  { id: "sma50", label: "SMA 50", color: "#f59e0b" },
  { id: "sma100", label: "SMA 100", color: "#a78bfa" },
  { id: "sma150", label: "SMA 150", color: "#f472b6" },
  { id: "sma200", label: "SMA 200", color: "#ef4444" },
  { id: "ema20", label: "EMA 20", color: "#2dd4bf" },
  { id: "ema50", label: "EMA 50", color: "#facc15" },
  { id: "boll", label: "Bollinger", color: "#64748b" },
  { id: "vwap", label: "VWAP", color: "#e879f9" },
] as const;

type OverlayId = (typeof OVERLAY_DEFS)[number]["id"];

/** Build the plain-English trend interpretation from indicator state. */
function interpret(b: IndicatorBundle, beginner: boolean): { headline: string; points: string[]; risks: string[] } {
  const last = (xs: number[]) => xs[xs.length - 1];
  const p = last(b.closes);
  const above50 = p > last(b.sma50), above200 = p > last(b.sma200);
  const aligned = last(b.sma50) > last(b.sma150) && last(b.sma150) > last(b.sma200);
  const slope200 = slopePctPerDay(b.sma200, 40);
  const r = last(b.rsi14);
  const macdBull = last(b.macd.macd) > last(b.macd.signal);
  const points: string[] = [];
  const risks: string[] = [];

  let headline: string;
  if (above50 && above200 && aligned && slope200 > 0) headline = "Established uptrend";
  else if (above200 && slope200 > 0) headline = "Uptrend, taking a breather";
  else if (!above200 && slope200 < 0) headline = "Downtrend";
  else headline = "Mixed / transitioning";

  points.push(
    above200
      ? `Price is above its 200-day average${slope200 > 0.02 ? ", and that average is rising — the long-term trend is up" : ", but the long-term average is flat"}.`
      : `Price is below its 200-day average — long-term trend is ${slope200 < -0.02 ? "down" : "unclear"}. ${beginner ? "Most failed bullish trades happen fighting this." : ""}`
  );
  points.push(
    above50
      ? "Price is also above its 50-day average, so the medium-term trend agrees."
      : "Price is below its 50-day average — the medium-term trend is still working against it."
  );
  if (aligned) points.push("Moving averages are stacked bullishly (50 over 150 over 200) — the classic healthy-uptrend signature.");
  points.push(
    isNaN(r) ? "" :
    r > 70 ? `RSI is ${r.toFixed(0)} — momentum is strong but stretched. Chasing here has worse odds; pullbacks are common from this zone.` :
    r > 50 ? `RSI is ${r.toFixed(0)} — momentum is positive without being overheated.` :
    r > 35 ? `RSI is ${r.toFixed(0)} — momentum is soft; watch for a recovery back above 50.` :
    `RSI is ${r.toFixed(0)} — the stock has been beaten up recently. Oversold can stay oversold; wait for stabilization.`
  );
  points.push(macdBull ? "MACD is above its signal line — short-term momentum currently favors buyers." : "MACD is below its signal line — short-term momentum currently favors sellers.");

  if (r > 70) risks.push("Overbought momentum: strong stocks can keep running, but entries here have less margin for error.");
  if (!above200) risks.push("Below the 200-day average: bullish signals fail more often against the long-term trend.");
  if (b.relVol < 0.7) risks.push("Volume is unusually quiet — moves without volume are easier to reverse.");
  const bandWidth = (last(b.boll.upper) - last(b.boll.lower)) / p;
  if (bandWidth > 0.16) risks.push("Volatility is elevated (wide Bollinger Bands) — expect bigger daily swings; size positions accordingly.");
  if (risks.length === 0) risks.push("Even clean setups fail regularly. Decide an exit level before entering, and never risk money you can't afford to lose.");

  return { headline, points: points.filter(Boolean), risks };
}

export default function StockDetail() {
  const { symbol = "" } = useParams();
  const sym = symbol.toUpperCase();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [daily, setDaily] = useState<Candle[] | null>(null);
  const [tf, setTf] = useState<Timeframe>("6M");
  const [tfCandles, setTfCandles] = useState<Candle[] | null>(null);
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [overlaysOn, setOverlaysOn] = useState<Set<OverlayId>>(new Set(["sma50", "sma200"]));
  const [activePattern, setActivePattern] = useState<PatternHit | null>(null);
  const [drawer, setDrawer] = useState<"setup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isWatched, watchlists, toggleSymbol, settings } = useStore();

  useEffect(() => {
    let dead = false;
    setCompany(null); setDaily(null); setError(null); setActivePattern(null);
    (async () => {
      try {
        const p = provider();
        // Benchmark first so the checklist's relative-strength check has data.
        const [c, q, d] = await Promise.all([p.getCompany(sym), p.getQuote(sym), p.getDailyHistory(sym), ensureBenchmark()]);
        if (dead) return;
        setCompany(c); setQuote(q); setDaily(d);
        const unsub = p.subscribeQuotes([sym], (nq) => !dead && setQuote(nq));
        return unsub;
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Unknown symbol");
      }
    })();
    return () => { dead = true; };
  }, [sym]);

  useEffect(() => {
    let dead = false;
    setTfCandles(null);
    provider().getCandles(sym, tf).then((c) => !dead && setTfCandles(c)).catch(() => !dead && setTfCandles([]));
    return () => { dead = true; };
  }, [sym, tf]);

  const bundle = useMemo(() => (daily ? computeBundle(daily) : null), [daily]);
  const scan = useMemo(() => (daily ? evaluateSymbol(sym, daily) : null), [daily, sym]);
  const candleHits = useMemo(() => (daily ? detectRecentCandlePatterns(daily, 8) : []), [daily]);
  const interp = useMemo(() => (bundle ? interpret(bundle, settings.beginnerMode) : null), [bundle, settings.beginnerMode]);

  // Overlays are computed on the full daily history so long averages exist,
  // then the chart aligns them to the visible tail.
  const overlays: OverlayLine[] = useMemo(() => {
    if (!bundle || !daily || !tfCandles || tf === "1D") return [];
    const out: OverlayLine[] = [];
    for (const def of OVERLAY_DEFS) {
      if (!overlaysOn.has(def.id)) continue;
      if (def.id === "boll") {
        out.push({ id: "bu", label: "Boll upper", color: def.color, values: bundle.boll.upper, dashed: true });
        out.push({ id: "bm", label: "Boll mid", color: def.color, values: bundle.boll.mid });
        out.push({ id: "bl", label: "Boll lower", color: def.color, values: bundle.boll.lower, dashed: true });
      } else if (def.id === "vwap") {
        out.push({ id: "vwap", label: "VWAP (20d rolling)", color: def.color, values: vwap(daily, 20), dashed: true });
      } else {
        out.push({ id: def.id, label: def.label, color: def.color, values: bundle[def.id as keyof IndicatorBundle] as number[] });
      }
    }
    return out;
  }, [bundle, daily, overlaysOn, tf, tfCandles]);

  const intradayVwap: OverlayLine[] = useMemo(() => {
    if (tf !== "1D" || !tfCandles || !overlaysOn.has("vwap")) return [];
    return [{ id: "vwap", label: "VWAP", color: "#e879f9", values: vwap(tfCandles, null) }];
  }, [tf, tfCandles, overlaysOn]);

  if (error) return <EmptyState title={`Couldn't load ${sym}`} hint={error} action={<Link className="btn" to="/screener">Back to screener</Link>} />;
  if (!company || !quote || !daily || !bundle || !scan || !interp) {
    return <div className="stack"><SkeletonCard lines={2} /><SkeletonCard lines={8} /><SkeletonCard lines={4} /></div>;
  }

  const watched = isWatched(sym);
  const up = quote.changePct >= 0;
  const metConditions = scan.conditions.filter((c) => c.met);

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Header */}
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <button className="btn ghost sm" style={{ marginBottom: 6, marginLeft: -8 }} onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}>
            ← Back
          </button>
          <div className="row wrap" style={{ gap: 8 }}>
            <h1>{company.name} <span className="muted" style={{ fontWeight: 500 }}>({sym})</span></h1>
            <span className="badge neutral">{company.sector}</span>
            <span className="badge outline">{company.universe === "sp500" ? "S&P 500" : "Russell 2000"}</span>
          </div>
          <div className="row wrap" style={{ marginTop: 6, gap: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 750 }} className="mono">{fmtPrice(quote.price)}</span>
            <span className={classNames("mono", up ? "up" : "down")} style={{ fontSize: 16, fontWeight: 650 }}>
              {fmtChange(quote.change)} ({fmtPct(quote.changePct)})
            </span>
            {quote.marketState && quote.marketState !== "REGULAR" && (
              <span className="badge neutral">
                {quote.marketState === "PRE" ? "Pre-market" : quote.marketState === "POST" ? "After hours" : "Market closed"}
              </span>
            )}
            <DataSourceBadge />
          </div>
          {quote.extendedPrice != null && (quote.marketState === "PRE" || quote.marketState === "POST") && (
            <div className="row wrap" style={{ marginTop: 4, gap: 8 }}>
              <span className="muted small" style={{ fontWeight: 650 }}>
                {quote.marketState === "PRE" ? "Pre-market:" : "After hours:"}
              </span>
              <span className="mono small" style={{ fontWeight: 700 }}>{fmtPrice(quote.extendedPrice)}</span>
              <span className={classNames("mono small", (quote.extendedChangePct ?? 0) >= 0 ? "up" : "down")} style={{ fontWeight: 650 }}>
                {fmtPct(quote.extendedChangePct ?? 0)}
              </span>
              <Tooltip text="Trading that happens before 9:30am or after 4:00pm ET. Volume is thinner, so prices can move on very little activity — treat extended-hours moves with extra caution." />
            </div>
          )}
        </div>
        <div className="row">
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(window.location.href); }} title="Copy link to share">
            <IconShare className="icon" style={{ width: 15, height: 15 }} /> Share
          </button>
          <button
            className={classNames("btn", watched && "primary")}
            onClick={() => watchlists[0] && toggleSymbol(watchlists[0].id, sym)}
          >
            <IconStar className="icon" filled={watched} style={{ width: 15, height: 15 }} />
            {watched ? "Watching" : "Watch"}
          </button>
        </div>
      </div>

      <div className="grid main-split wide">
        {/* Chart column */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="card">
            <div className="row between wrap" style={{ marginBottom: 8 }}>
              <Seg options={TIMEFRAMES} value={tf} onChange={setTf} />
              <div className="row">
                <Seg options={[{ value: "candles", label: "Candles" }, { value: "line", label: "Line" }] as const} value={mode} onChange={setMode} />
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
              {OVERLAY_DEFS.map((d) => {
                const disabled = tf === "1D" && d.id !== "vwap";
                return (
                  <button
                    key={d.id}
                    className="badge"
                    disabled={disabled}
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer", border: "1px solid",
                      borderColor: overlaysOn.has(d.id) ? d.color : "var(--border)",
                      color: overlaysOn.has(d.id) ? d.color : "var(--text-faint)",
                      background: "transparent", opacity: disabled ? 0.4 : 1,
                    }}
                    onClick={() => setOverlaysOn((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })}
                  >
                    {d.label}
                  </button>
                );
              })}
              <Tooltip text="Overlays draw indicator lines on the price chart. Moving averages show the trend; Bollinger Bands show volatility; VWAP shows the volume-weighted 'fair price'. Toggle them on and off to compare. (On the 1D view only intraday VWAP applies.)" />
            </div>
            {tfCandles === null ? (
              <Skeleton h={360} />
            ) : tfCandles.length === 0 ? (
              <EmptyState title="No data for this timeframe" />
            ) : (
              <PriceChart
                candles={tfCandles}
                mode={tf === "1D" ? (mode === "candles" ? "candles" : "line") : mode}
                overlays={tf === "1D" ? intradayVwap : overlays}
                pattern={tf !== "1D" && tf !== "5D" ? activePattern : null}
                historyLength={daily.length}
                height={400}
              />
            )}
            {activePattern && (
              <div className="row between" style={{ marginTop: 8, background: "var(--accent-soft)", borderRadius: 8, padding: "8px 12px" }}>
                <span className="small"><b>{activePattern.label}</b> annotated on chart — key points marked in purple.</span>
                <button className="btn ghost sm" onClick={() => setActivePattern(null)}>Clear</button>
              </div>
            )}
          </div>

          {/* Lower indicator panels (daily-based) */}
          {tf !== "1D" && (
            <div className="card stack" style={{ gap: 4 }}>
              <IndicatorPanel
                title="RSI (14)" visible={tfCandles?.length ?? 60}
                series={[{ label: "RSI", color: "var(--purple)", values: bundle.rsi14 }]}
                refLines={[{ value: 70, label: "70" }, { value: 50, label: "50" }, { value: 30, label: "30" }]}
                domain={[0, 100]}
              />
              <IndicatorPanel
                title="MACD (12, 26, 9)" visible={tfCandles?.length ?? 60}
                series={[
                  { label: "MACD", color: "var(--accent)", values: bundle.macd.macd },
                  { label: "Signal", color: "var(--warn)", values: bundle.macd.signal },
                ]}
                histogram={bundle.macd.histogram}
                refLines={[{ value: 0, label: "0" }]}
              />
              <IndicatorPanel
                title="Stochastic (14, 3)" visible={tfCandles?.length ?? 60}
                series={[
                  { label: "%K", color: "var(--teal)", values: bundle.stoch.k },
                  { label: "%D", color: "var(--down)", values: bundle.stoch.d },
                ]}
                refLines={[{ value: 80, label: "80" }, { value: 20, label: "20" }]}
                domain={[0, 100]}
              />
            </div>
          )}

          {/* Plain-English interpretation */}
          <div className="card">
            <div className="card-title">
              <h2>What the chart is saying <span className="badge accent" style={{ marginLeft: 6 }}>{interp.headline}</span></h2>
              <Tooltip text="A plain-English reading of the indicators above. It describes what has been happening — it cannot predict what happens next." />
            </div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {interp.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <h3 style={{ margin: "14px 0 6px" }}>Risk notes</h3>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {interp.risks.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>

        {/* Right column */}
        <div className="stack" style={{ gap: 14 }}>
          {/* Setup score */}
          <div className="card">
            <div className="card-title">
              <h2>Bullish setup score</h2>
              <Tooltip text="The scanner's transparent checklist for this stock. Each condition has fixed points; the score is just the sum of what's true right now. No black box." />
            </div>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ fontSize: 30, fontWeight: 800 }} className="mono">{scan.score}</span>
              <div>
                <div className="faint">out of {scan.maxScore} possible</div>
                <div className="scorebar" style={{ width: 130, marginTop: 4 }}>
                  <div style={{ width: `${(scan.score / scan.maxScore) * 100}%`, background: scan.score / scan.maxScore >= 0.5 ? "var(--up)" : scan.score / scan.maxScore >= 0.3 ? "var(--warn)" : "var(--text-faint)" }} />
                </div>
              </div>
            </div>
            <p className="small muted" style={{ margin: "10px 0" }}>{scan.summary}</p>
            <button className="btn sm" onClick={() => setDrawer("setup")}>See full checklist ({metConditions.length}/{scan.conditions.length} met)</button>
          </div>

          {/* Patterns */}
          <div className="card">
            <div className="card-title"><h2>Detected patterns</h2>
              <Tooltip text="Chart patterns found by the detection engine in the recent daily candles. Click one to annotate it on the chart. Confidence measures geometric fit, not probability of success." />
            </div>
            {scan.patterns.length === 0 && candleHits.length === 0 && (
              <p className="small muted" style={{ margin: 0 }}>No notable patterns detected in recent trading. That's normal — clean patterns are rare, which is exactly why they're worth attention when they appear.</p>
            )}
            {scan.patterns.map((p) => (
              <div key={p.kind} className="condition-row" style={{ cursor: "pointer" }} onClick={() => setActivePattern(activePattern?.kind === p.kind ? null : p)}>
                <div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <b className="small">{p.label}</b>
                    <ConfidenceBadge confidence={p.confidence} />
                    {activePattern?.kind === p.kind && <span className="badge accent">on chart</span>}
                  </div>
                  <div className="faint" style={{ marginTop: 3 }}>{p.explanation}</div>
                </div>
              </div>
            ))}
            {candleHits.slice(0, 3).map((h, i) => (
              <div key={i} className="condition-row">
                <div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <b className="small">{h.label}</b>
                    <span className={classNames("badge", h.bias === "bullish" ? "up" : h.bias === "bearish" ? "down" : "neutral")}>{h.bias} candle</span>
                  </div>
                  <div className="faint" style={{ marginTop: 3 }}>{h.explanation}</div>
                </div>
              </div>
            ))}
            {(scan.patterns.length > 0 || candleHits.length > 0) && (
              <p className="faint" style={{ margin: "10px 0 0" }}>
                Patterns describe crowd behavior, not certainty — treat them as reasons to look closer. <Link to="/patterns">Learn how each is detected →</Link>
              </p>
            )}
          </div>

          {/* Fundamentals */}
          <div className="card">
            <div className="card-title"><h2>Company facts</h2></div>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="kpi"><span className="label">Market cap <Tooltip text="Total value of all shares — the company's size. Mega caps move slower; small caps swing harder." /></span><span className="value">{fmtBig(company.marketCap)}</span></div>
              <div className="kpi"><span className="label">P/E <Tooltip text="Price per $1 of yearly profit. Compare within the same industry — 'high' for a bank may be 'low' for software." /></span><span className="value">{company.pe?.toFixed(1) ?? "—"}</span></div>
              <div className="kpi"><span className="label">Forward P/E <Tooltip text="Same idea, but using next year's expected earnings instead of the past year's." /></span><span className="value">{company.forwardPe?.toFixed(1) ?? "—"}</span></div>
              <div className="kpi"><span className="label">EPS <Tooltip text="Earnings per share: annual profit divided by share count." /></span><span className="value">{company.eps == null ? "—" : `$${company.eps.toFixed(2)}`}</span></div>
              <div className="kpi"><span className="label">Revenue (TTM)</span><span className="value">{fmtBig(company.revenue)}</span></div>
              <div className="kpi"><span className="label">Dividend yield <Tooltip text="Annual dividends as a percent of the share price. '—' means the company doesn't pay one." /></span><span className="value">{company.dividendYield == null ? "—" : `${company.dividendYield.toFixed(2)}%`}</span></div>
              <div className="kpi"><span className="label">Beta <Tooltip text="How much the stock tends to move relative to the market. 1.5 = moves ~50% more than the index, both directions." /></span><span className="value">{company.beta.toFixed(2)}</span></div>
              <div className="kpi"><span className="label">Avg volume</span><span className="value">{fmtVolume(quote.avgVolume)}</span></div>
            </div>
            <div className="faint" style={{ marginTop: 10 }}>{company.industry}</div>
            <p className="small muted" style={{ marginBottom: 0 }}>{company.summary}</p>
          </div>
        </div>
      </div>

      {/* Setup checklist drawer */}
      {drawer === "setup" && (
        <Drawer title={`${sym} setup checklist`} onClose={() => setDrawer(null)}>
          <p className="small muted">
            Every condition the scanner checks, with its point weight. The setup score is simply the sum of the points for conditions that are currently true.
          </p>
          {scan.conditions.map((c) => (
            <div key={c.id} className="condition-row">
              <span className={classNames("condition-dot", c.met ? "met" : "unmet")}>{c.met ? "✓" : "·"}</span>
              <div>
                <div className="small" style={{ fontWeight: 650 }}>{c.label} <span className="faint">+{c.weight} pts</span></div>
                <div className="faint">{c.detail}</div>
              </div>
            </div>
          ))}
          {scan.patterns[0] && (
            <div className="condition-row">
              <span className="condition-dot met">✓</span>
              <div>
                <div className="small" style={{ fontWeight: 650 }}>Bullish pattern bonus <span className="faint">+{Math.round(scan.patterns[0].confidence * 8)} pts</span></div>
                <div className="faint">{scan.patterns[0].label} at {Math.round(scan.patterns[0].confidence * 100)}% confidence (bonus scales with confidence, max 8).</div>
              </div>
            </div>
          )}
          <p className="faint" style={{ marginTop: 14 }}>
            A high score means several bullish observations line up — it is not a prediction. Signals are probabilistic and fail regularly.
          </p>
        </Drawer>
      )}
    </div>
  );
}
