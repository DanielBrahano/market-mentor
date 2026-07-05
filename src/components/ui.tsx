import React, { useEffect } from "react";
import { classNames, fmtPct, fmtPrice } from "../lib/utils";
import type { MarketState } from "../lib/types";
import { FRESHNESS_HELP, FRESHNESS_LABEL, provider } from "../lib/data/provider";
import { IconInfo, IconX } from "./icons";

/** Small reusable UI primitives. */

/**
 * Extended-hours (pre-market / after-hours) price + change.
 * Renders nothing unless the market is in a PRE or POST session and the
 * provider supplied an extended price — so it's safe to drop in everywhere.
 */
export function ExtHours({
  state, price, changePct, showPrice = false, style,
}: {
  state?: MarketState;
  price?: number;
  changePct?: number;
  showPrice?: boolean;
  style?: React.CSSProperties;
}) {
  if ((state !== "PRE" && state !== "POST") || price == null || changePct == null) return null;
  const label = state === "PRE" ? "Pre-mkt" : "After hrs";
  return (
    <span className="faint" style={{ whiteSpace: "nowrap", display: "inline-flex", gap: 4, alignItems: "baseline", ...style }}>
      <span>{label}</span>
      {showPrice && <span className="mono">{fmtPrice(price)}</span>}
      <span className={classNames("mono", changePct >= 0 ? "up" : "down")}>{fmtPct(changePct)}</span>
    </span>
  );
}

export function Tooltip({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <span className="tip" tabIndex={0}>
      {children ?? <span className="tip-icon">?</span>}
      <span className="tip-body">{text}</span>
    </span>
  );
}

export function PctBadge({ value }: { value: number }) {
  const cls = value > 0.001 ? "up" : value < -0.001 ? "down" : "neutral";
  return <span className={classNames("badge", cls, "mono")}>{value > 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 70 ? "up" : pct >= 50 ? "warn" : "neutral";
  return (
    <Tooltip text={`Detection confidence: how cleanly this setup matches the textbook rules. ${pct}% means a ${pct >= 70 ? "clean" : pct >= 50 ? "reasonable" : "rough"} fit — never a guarantee. Patterns fail regularly even at high confidence.`}>
      <span className={classNames("badge", cls)}>{pct}% confidence</span>
    </Tooltip>
  );
}

export function DataSourceBadge() {
  const p = provider();
  return (
    <Tooltip text={FRESHNESS_HELP[p.freshness]}>
      <span className="badge outline">
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.freshness === "simulated" ? "var(--warn)" : "var(--up)", display: "inline-block" }} />
        {FRESHNESS_LABEL[p.freshness]}
      </span>
    </Tooltip>
  );
}

export function Skeleton({ w, h = 14, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card stack">
      <Skeleton w="40%" h={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={`${88 - i * 14}%`} />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <IconInfo className="icon" />
      <div style={{ fontWeight: 650, marginBottom: 4 }}>{title}</div>
      {hint && <div className="small" style={{ maxWidth: 380, margin: "0 auto" }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="empty">
      <div style={{ fontWeight: 650, color: "var(--down)", marginBottom: 4 }}>Something went wrong</div>
      <div className="small">{message}</div>
      {retry && <button className="btn sm" style={{ marginTop: 12 }} onClick={retry}>Try again</button>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="row" style={{ cursor: "pointer", gap: 9 }}>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" />
      </span>
      {label && <span className="small" style={{ fontWeight: 600 }}>{label}</span>}
    </label>
  );
}

export function Drawer({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><IconX className="icon" style={{ width: 16, height: 16 }} /></button>
        </div>
        {children}
      </div>
    </>
  );
}

export function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 50 ? "var(--up)" : pct >= 30 ? "var(--warn)" : "var(--text-faint)";
  return (
    <div className="scorebar" style={{ width: 90 }}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: readonly (T | { readonly value: T; readonly label: string })[]; value: T; onChange: (v: T) => void }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="seg">
      {opts.map((o) => (
        <button key={o.value} className={o.value === value ? "active" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
