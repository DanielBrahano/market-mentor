import React from "react";
import type { Quote, ScanResult } from "../lib/types";
import { scoreBand } from "../lib/scanner/engine";
import { classNames, fmtPct, fmtPrice, fmtVolume } from "../lib/utils";
import { ConfidenceBadge, ExtHours, ScoreBar } from "./ui";
import { MiniCandles } from "./charts/Sparkline";
import { IconStar } from "./icons";

/**
 * Phone-friendly replacement for a scanner table row: everything a row shows,
 * laid out as a tappable card — no sideways scrolling needed.
 */
export function StockRowCard({
  r, quote, onOpen, watched, onToggleWatch, showSummary = false,
}: {
  r: ScanResult;
  quote?: Quote;
  onOpen: () => void;
  watched?: boolean;
  onToggleWatch?: () => void;
  showSummary?: boolean;
}) {
  const price = quote?.price ?? r.price;
  const chg = quote?.changePct ?? r.changePct;
  const ext = quote ?? r;
  const band = scoreBand(r.score, r.maxScore);
  return (
    <div className="card stock-row-card" onClick={onOpen}>
      <div className="row between" style={{ alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="ticker-link" style={{ fontSize: 15 }}>{r.symbol}</span>
            {onToggleWatch && (
              <span onClick={(e) => { e.stopPropagation(); onToggleWatch(); }} style={{ display: "inline-flex", padding: 4, margin: -4 }}>
                <IconStar className="icon" filled={watched} style={{ width: 17, height: 17, color: watched ? "var(--warn)" : "var(--text-faint)" }} />
              </span>
            )}
          </div>
          <div className="faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>{r.name}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{fmtPrice(price)}</div>
          <div className={classNames("mono small", chg >= 0 ? "up" : "down")} style={{ fontWeight: 650 }}>{fmtPct(chg)}</div>
          <ExtHours state={ext.marketState} price={ext.extendedPrice} changePct={ext.extendedChangePct} />
        </div>
      </div>
      <div className="row between" style={{ marginTop: 10, gap: 10 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <ScoreBar score={r.score} max={r.maxScore} />
          <span className="mono small" style={{ fontWeight: 700 }}>{r.score}</span>
          <span className={classNames("badge", band.tone === "strong" ? "up" : band.tone === "moderate" ? "warn" : "neutral")}>{band.label}</span>
        </div>
        <MiniCandles candles={r.candles60.slice(-30)} width={86} height={30} />
      </div>
      {/* Verification line: what kind of thing this is and how actively it trades */}
      <div className="faint" style={{ marginTop: 8 }}>
        {r.sector} · {r.universe === "sp500" ? "S&P 500" : "Small cap"} · RVOL {r.relVol.toFixed(1)}× · Avg vol {fmtVolume(r.avgVolume)}
      </div>
      {r.patterns[0] && (
        <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
          <span className="badge accent">{r.patterns[0].label}</span>
          <ConfidenceBadge confidence={r.patterns[0].confidence} />
        </div>
      )}
      {showSummary && <p className="small muted" style={{ margin: "8px 0 0" }}>{r.summary}</p>}
    </div>
  );
}
