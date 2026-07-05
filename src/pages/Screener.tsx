import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ScanResult } from "../lib/types";
import { scanUniverse, scoreBand } from "../lib/scanner/engine";
import { SECTORS } from "../lib/data/universe";
import { classNames, fmtBig, fmtPct, fmtPrice } from "../lib/utils";
import { useStore } from "../state/store";
import { ConfidenceBadge, EmptyState, ExtHours, ScoreBar, Tooltip, Seg } from "../components/ui";
import { ScanProgress } from "../components/ScanProgress";
import { MiniCandles } from "../components/charts/Sparkline";
import { IconStar } from "../components/icons";

interface Filters {
  universe: "all" | "sp500" | "russell2000";
  sector: string;
  capMin: number | "";
  capMax: number | "";
  peMax: number | "";
  priceMin: number | "";
  priceMax: number | "";
  avgVolMin: number | "";
  rsiMin: number | "";
  rsiMax: number | "";
  macdBull: boolean;
  maAligned: boolean;
  relVolMin: number | "";
  withPattern: boolean;
  minScore: number;
}

const DEFAULT_FILTERS: Filters = {
  universe: "all", sector: "All", capMin: "", capMax: "", peMax: "",
  priceMin: "", priceMax: "", avgVolMin: "", rsiMin: "", rsiMax: "",
  macdBull: false, maAligned: false, relVolMin: "", withPattern: false, minScore: 0,
};

type SortKey = "symbol" | "price" | "changePct" | "score" | "marketCap" | "pe" | "rsi" | "relVol";
const PAGE = 100;

export default function Screener() {
  const [rows, setRows] = useState<ScanResult[] | null>(null);
  const [universeSize, setUniverseSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const [saveName, setSaveName] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const { savedScreens, saveScreen, deleteScreen, isWatched, watchlists, toggleSymbol, settings } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    let dead = false;
    scanUniverse()
      .then((s) => { if (!dead) { setRows(s.results); setUniverseSize(s.universeSize); } })
      .catch((e) => !dead && setError(e instanceof Error ? e.message : "Scan failed"));
    return () => { dead = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const f = filters;
    const out = rows.filter((r) => {
      if (f.universe !== "all" && r.universe !== f.universe) return false;
      if (f.sector !== "All" && r.sector !== f.sector) return false;
      if (f.capMin !== "" && r.marketCap < f.capMin * 1e9) return false;
      if (f.capMax !== "" && r.marketCap > f.capMax * 1e9) return false;
      if (f.peMax !== "" && (r.pe == null || r.pe > f.peMax)) return false;
      if (f.priceMin !== "" && r.price < f.priceMin) return false;
      if (f.priceMax !== "" && r.price > f.priceMax) return false;
      if (f.avgVolMin !== "" && r.avgVolume < f.avgVolMin * 1e6) return false;
      if (f.rsiMin !== "" && r.rsi < f.rsiMin) return false;
      if (f.rsiMax !== "" && r.rsi > f.rsiMax) return false;
      if (f.macdBull && !r.macdBull) return false;
      if (f.maAligned && !r.maAligned) return false;
      if (f.relVolMin !== "" && r.relVol < f.relVolMin) return false;
      if (f.withPattern && r.patterns.length === 0) return false;
      if (r.score < f.minScore) return false;
      return true;
    });
    out.sort((a, b) => {
      const k = sort.key;
      const av = a[k] ?? -Infinity, bv = b[k] ?? -Infinity;
      if (typeof av === "string") return sort.dir * av.localeCompare(bv as string);
      return sort.dir * ((av as number) - (bv as number));
    });
    return out;
  }, [rows, filters, sort]);

  // Reset pagination when filters/sort change.
  useEffect(() => setLimit(PAGE), [filters, sort]);

  const th = (key: SortKey, label: string, tip?: string) => (
    <th className="sortable" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {label}{tip && <> <Tooltip text={tip} /></>}{sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );

  const num = (key: keyof Filters, placeholder: string, step = 1) => (
    <input
      className="input" type="number" step={step} placeholder={placeholder} style={{ width: 90 }}
      value={filters[key] as number | ""}
      onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value === "" ? "" : Number(e.target.value) }))}
    />
  );

  if (error) return <EmptyState title="Scan failed" hint={error} />;

  const visible = filtered?.slice(0, limit);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <h1>Screener</h1>
          <div className="muted small">
            {settings.beginnerMode
              ? `Filter ${universeSize ? universeSize.toLocaleString() : "the"} S&P 500 and Russell 2000 stocks by fundamentals and technicals. Hover any ? bubble to learn what a filter means.`
              : `Full S&P 500 + Russell 2000 universe (${universeSize.toLocaleString()} stocks) with fundamental and technical filters.`}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setShowFilters((s) => !s)}>{showFilters ? "Hide" : "Show"} filters</button>
          <button className="btn ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset</button>
        </div>
      </div>

      {/* Saved screens */}
      {savedScreens.length > 0 && (
        <div className="row wrap">
          <span className="faint" style={{ fontWeight: 700 }}>Saved screens:</span>
          {savedScreens.map((s) => (
            <span key={s.id} className="badge outline" style={{ cursor: "pointer", padding: "4px 10px" }}
              onClick={() => setFilters({ ...DEFAULT_FILTERS, ...(s.filters as Partial<Filters>) })}>
              {s.name}
              <span style={{ cursor: "pointer", marginLeft: 4, opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); deleteScreen(s.id); }}>✕</span>
            </span>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="card">
          <div className="row wrap" style={{ gap: 14, alignItems: "flex-end" }}>
            <label className="field">Universe
              <Seg
                options={[{ value: "all", label: "All" }, { value: "sp500", label: "S&P 500" }, { value: "russell2000", label: "Russell 2000" }] as const}
                value={filters.universe}
                onChange={(v) => setFilters((f) => ({ ...f, universe: v }))}
              />
            </label>
            <label className="field">Sector
              <select className="input" value={filters.sector} onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}>
                <option>All</option>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">Market cap ($B) <Tooltip text="Company size: share price × total shares. Big companies are steadier; small ones move more (both ways)." />
              <span className="row">{num("capMin", "min")}{num("capMax", "max")}</span>
            </label>
            <label className="field">P/E max <Tooltip text="Price-to-earnings: what you pay per $1 of yearly profit. Filters out stocks 'more expensive' than your cap. Stocks with no profits are excluded when set." />
              {num("peMax", "e.g. 40")}
            </label>
            <label className="field">Price ($)
              <span className="row">{num("priceMin", "min")}{num("priceMax", "max")}</span>
            </label>
            <label className="field">Avg volume (M) <Tooltip text="Average daily shares traded (millions). Higher = easier to buy and sell without moving the price." />
              {num("avgVolMin", "min", 0.5)}
            </label>
            <label className="field">RSI range <Tooltip text="Momentum from 0–100. 30–50 can mean 'recovering from a dip'; 50–70 'trending but not overheated'; above 70 'running hot'." />
              <span className="row">{num("rsiMin", "min")}{num("rsiMax", "max")}</span>
            </label>
            <label className="field">Rel. volume ≥ <Tooltip text="Today's volume vs its 20-day average. 1.5 means 50% busier than usual — unusual interest." />
              {num("relVolMin", "e.g. 1.5", 0.1)}
            </label>
            <label className="field">Min setup score <Tooltip text="The scanner's transparent bullish score (sum of met condition weights, max ~102). 30+ = developing setup, 50+ = strong setup." />
              {num("minScore", "0", 5)}
            </label>
            <div className="stack" style={{ gap: 8 }}>
              <label className="row small" style={{ cursor: "pointer", fontWeight: 600 }}>
                <input type="checkbox" checked={filters.macdBull} onChange={(e) => setFilters((f) => ({ ...f, macdBull: e.target.checked }))} />
                MACD bullish <Tooltip text="Only stocks whose MACD line is above its signal line — short-term momentum currently beating longer-term momentum." />
              </label>
              <label className="row small" style={{ cursor: "pointer", fontWeight: 600 }}>
                <input type="checkbox" checked={filters.maAligned} onChange={(e) => setFilters((f) => ({ ...f, maAligned: e.target.checked }))} />
                MA aligned (50&gt;150&gt;200) <Tooltip text="Moving averages stacked in bullish order — the classic signature of an established uptrend." />
              </label>
              <label className="row small" style={{ cursor: "pointer", fontWeight: 600 }}>
                <input type="checkbox" checked={filters.withPattern} onChange={(e) => setFilters((f) => ({ ...f, withPattern: e.target.checked }))} />
                Has bullish pattern <Tooltip text="Only stocks where the pattern engine currently detects a bullish chart pattern (flag, double bottom, ascending triangle...)." />
              </label>
            </div>
            <div className="row" style={{ marginLeft: "auto" }}>
              <input className="input" placeholder="Screen name…" value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ width: 140 }} />
              <button className="btn" disabled={!saveName.trim()} onClick={() => { saveScreen(saveName.trim(), filters as unknown as Record<string, unknown>); setSaveName(""); }}>Save screen</button>
            </div>
          </div>
        </div>
      )}

      {!rows && <ScanProgress label="Scanning the full market" />}

      {rows && (
        <div className="card pad-0">
          <div className="row between" style={{ padding: "12px 16px 0" }}>
            <span className="muted small">
              {filtered ? `${filtered.length.toLocaleString()} match${filtered.length === 1 ? "" : "es"} of ${universeSize.toLocaleString()} scanned` : ""}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th></th>
                  {th("symbol", "Symbol")}
                  {th("price", "Price")}
                  {th("changePct", "Today")}
                  {th("score", "Score", "Transparent bullish setup score — the sum of points from each met condition. Click the row for the full checklist.")}
                  {th("marketCap", "Mkt cap")}
                  {th("pe", "P/E")}
                  {th("rsi", "RSI")}
                  {th("relVol", "RVOL", "Relative volume vs 20-day average")}
                  <th>Pattern</th>
                  <th>Trend (60d)</th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.length === 0 && (
                  <tr><td colSpan={11}><EmptyState title="No stocks match these filters" hint="Try loosening a filter or two — strict combinations often produce zero matches." /></td></tr>
                )}
                {visible?.map((r) => {
                  const band = scoreBand(r.score, r.maxScore);
                  const watched = isWatched(r.symbol);
                  return (
                    <tr key={r.symbol} onClick={() => nav(`/stock/${r.symbol}`)}>
                      <td onClick={(e) => { e.stopPropagation(); if (watchlists[0]) toggleSymbol(watchlists[0].id, r.symbol); }}>
                        <IconStar className="icon" filled={watched} style={{ width: 16, height: 16, color: watched ? "var(--warn)" : "var(--text-faint)" }} />
                      </td>
                      <td><span className="ticker-link">{r.symbol}</span><div className="faint">{r.name}</div></td>
                      <td className="mono">
                        {fmtPrice(r.price)}
                        <div><ExtHours state={r.marketState} price={r.extendedPrice} changePct={r.extendedChangePct} /></div>
                      </td>
                      <td className={classNames("mono", r.changePct >= 0 ? "up" : "down")}>{fmtPct(r.changePct)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <ScoreBar score={r.score} max={r.maxScore} />
                          <span className="mono small" title={band.label}>{r.score}</span>
                        </div>
                      </td>
                      <td className="mono">{fmtBig(r.marketCap)}</td>
                      <td className="mono">{r.pe == null ? "—" : r.pe.toFixed(1)}</td>
                      <td className="mono">{isNaN(r.rsi) ? "—" : r.rsi.toFixed(0)}</td>
                      <td className={classNames("mono", r.relVol >= 1.5 ? "up" : undefined)}>{r.relVol.toFixed(1)}×</td>
                      <td>
                        {r.patterns[0] ? (
                          <span className="row" style={{ gap: 6 }}>
                            <span className="badge accent">{r.patterns[0].label}</span>
                            <ConfidenceBadge confidence={r.patterns[0].confidence} />
                          </span>
                        ) : <span className="faint">—</span>}
                      </td>
                      <td><MiniCandles candles={r.candles60.slice(-40)} width={100} height={34} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered && filtered.length > limit && (
            <div style={{ padding: 14, textAlign: "center" }}>
              <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, filtered.length - limit)} more ({(filtered.length - limit).toLocaleString()} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
