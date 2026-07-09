import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Quote } from "../lib/types";
import { provider } from "../lib/data/provider";
import { findEntry } from "../lib/data/universe";
import { classNames, fmtPct, fmtPrice, fmtVolume } from "../lib/utils";
import { useStore } from "../state/store";
import { EmptyState, ExtHours, Skeleton, Tooltip } from "../components/ui";
import { useIsMobile } from "../lib/useIsMobile";
import { IconPlus, IconX } from "../components/icons";
import { Sparkline } from "../components/charts/Sparkline";

function AddSymbol({ onAdd, existing }: { onAdd: (sym: string) => void; existing: string[] }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return provider().getUniverse().filter(
      (u) => !existing.includes(u.symbol) && (u.symbol.toLowerCase().includes(s) || u.name.toLowerCase().includes(s))
    ).slice(0, 6);
  }, [q, existing]);
  return (
    <div style={{ position: "relative" }}>
      <input className="input" placeholder="Add stock (ticker or name)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
      {matches.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, width: 280, background: "var(--bg-elev)", border: "1px solid var(--border-strong)", borderRadius: 10, zIndex: 50, boxShadow: "var(--shadow)", overflow: "hidden" }}>
          {matches.map((m) => (
            <div key={m.symbol} className="row between" style={{ padding: "8px 12px", cursor: "pointer" }}
              onMouseDown={() => { onAdd(m.symbol); setQ(""); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
              <span className="small"><b>{m.symbol}</b> <span className="muted">{m.name}</span></span>
              <IconPlus className="icon" style={{ width: 14, height: 14, color: "var(--accent)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Watchlists() {
  const { watchlists, createWatchlist, deleteWatchlist, toggleSymbol, settings } = useStore();
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [sparks, setSparks] = useState<Map<string, number[]>>(new Map());
  const [newName, setNewName] = useState("");
  const nav = useNavigate();
  const isMobile = useIsMobile();

  const allSymbols = useMemo(() => Array.from(new Set(watchlists.flatMap((w) => w.symbols))), [watchlists]);

  useEffect(() => {
    let dead = false;
    const p = provider();
    (async () => {
      const qs = await p.getQuotes(allSymbols);
      if (dead) return;
      setQuotes(new Map(qs.map((q) => [q.symbol, q])));
      const entries: [string, number[]][] = [];
      for (const sym of allSymbols) {
        const daily = await p.getDailyHistory(sym);
        entries.push([sym, daily.slice(-30).map((c) => c.c)]);
      }
      if (!dead) setSparks(new Map(entries));
    })();
    const unsub = p.subscribeQuotes(allSymbols, (q) => {
      if (!dead) setQuotes((m) => new Map(m).set(q.symbol, q));
    });
    return () => { dead = true; unsub(); };
  }, [allSymbols.join(",")]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <h1>Watchlists</h1>
          <div className="muted small">
            {settings.beginnerMode
              ? "Stocks you're keeping an eye on. Watchlist stocks power your alerts — when one triggers a rule (like crossing its 200-day average), you get notified."
              : "Personal watchlists. Alert rules with 'any watchlist stock' scope evaluate these symbols."}
          </div>
        </div>
        <div className="row">
          <input className="input" placeholder="New list name…" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: 160 }} />
          <button className="btn" disabled={!newName.trim()} onClick={() => { createWatchlist(newName.trim()); setNewName(""); }}>
            <IconPlus className="icon" style={{ width: 14, height: 14 }} /> New list
          </button>
        </div>
      </div>

      {watchlists.length === 0 && (
        <EmptyState title="No watchlists yet" hint="Create a list and add a few stocks you're curious about — alerts and the dashboard build on them." />
      )}

      {watchlists.map((wl) => (
        <div className="card pad-0" key={wl.id}>
          <div className="row between wrap" style={{ padding: "14px 16px 10px" }}>
            <div className="row">
              <h2>{wl.name}</h2>
              <span className="badge neutral">{wl.symbols.length} stocks</span>
            </div>
            <div className="row wrap">
              <AddSymbol existing={wl.symbols} onAdd={(sym) => toggleSymbol(wl.id, sym)} />
              {watchlists.length > 1 && (
                <button className="btn ghost sm" title="Delete list" onClick={() => { if (confirm(`Delete "${wl.name}"?`)) deleteWatchlist(wl.id); }}>
                  <IconX className="icon" style={{ width: 15, height: 15 }} />
                </button>
              )}
            </div>
          </div>
          {wl.symbols.length === 0 ? (
            <div style={{ padding: "0 16px 16px" }}>
              <EmptyState title="Empty list" hint="Use the search box above to add stocks." />
            </div>
          ) : isMobile ? (
            <div className="stack" style={{ gap: 10, padding: "0 12px 12px" }}>
              {wl.symbols.map((sym) => {
                const q = quotes.get(sym);
                const entry = findEntry(sym);
                const spark = sparks.get(sym);
                return (
                  <div key={sym} className="card stock-row-card" style={{ margin: 0 }} onClick={() => nav(`/stock/${sym}`)}>
                    <div className="row between" style={{ alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <span className="ticker-link" style={{ fontSize: 15 }}>{sym}</span>
                        <div className="faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{entry?.name}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{q ? fmtPrice(q.price) : "…"}</div>
                        {q && <div className={classNames("mono small", q.changePct >= 0 ? "up" : "down")} style={{ fontWeight: 650 }}>{fmtPct(q.changePct)}</div>}
                        {q && <ExtHours state={q.marketState} price={q.extendedPrice} changePct={q.extendedChangePct} showPrice />}
                      </div>
                    </div>
                    <div className="row between" style={{ marginTop: 10, gap: 10 }}>
                      <span className="faint" style={{ whiteSpace: "nowrap" }}>
                        Vol {q ? `${fmtVolume(q.volume)} (${(q.volume / q.avgVolume).toFixed(1)}×)` : "…"}
                      </span>
                      {spark ? <Sparkline values={spark} /> : <Skeleton w={100} h={28} />}
                      <button
                        className="btn ghost sm" title="Remove" style={{ flexShrink: 0 }}
                        onClick={(e) => { e.stopPropagation(); toggleSymbol(wl.id, sym); }}
                      >
                        <IconX className="icon" style={{ width: 15, height: 15 }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Symbol</th><th>Price</th><th>Today</th><th>Day range</th><th>Volume <Tooltip text="Shares traded today vs the 50-day average. High relative volume = unusual attention." /></th><th>30-day trend</th><th></th></tr>
                </thead>
                <tbody>
                  {wl.symbols.map((sym) => {
                    const q = quotes.get(sym);
                    const entry = findEntry(sym);
                    return (
                      <tr key={sym} onClick={() => nav(`/stock/${sym}`)}>
                        <td><span className="ticker-link">{sym}</span><div className="faint">{entry?.name}</div></td>
                        <td className="mono">
                          {q ? fmtPrice(q.price) : <Skeleton w={50} />}
                          {q && <div><ExtHours state={q.marketState} price={q.extendedPrice} changePct={q.extendedChangePct} showPrice /></div>}
                        </td>
                        <td className={classNames("mono", q && q.changePct >= 0 ? "up" : "down")}>{q ? fmtPct(q.changePct) : "…"}</td>
                        <td className="mono faint">{q ? `${fmtPrice(q.dayLow)} – ${fmtPrice(q.dayHigh)}` : "…"}</td>
                        <td className="mono">{q ? `${fmtVolume(q.volume)} (${(q.volume / q.avgVolume).toFixed(1)}×)` : "…"}</td>
                        <td>{sparks.get(sym) ? <Sparkline values={sparks.get(sym)!} /> : <Skeleton w={100} h={30} />}</td>
                        <td onClick={(e) => { e.stopPropagation(); toggleSymbol(wl.id, sym); }}>
                          <button className="btn ghost sm" title="Remove"><IconX className="icon" style={{ width: 14, height: 14 }} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
