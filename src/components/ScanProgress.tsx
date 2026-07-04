import React, { useEffect, useState } from "react";
import { onScanProgress } from "../lib/scanner/engine";

/**
 * Full-market scan progress. Shown while a page waits on the scan snapshot —
 * scanning ~2,400 stocks in the browser takes a few seconds by design.
 */
export function ScanProgress({ label = "Scanning the market" }: { label?: string }) {
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => onScanProgress((done, total) => setProg({ done, total })), []);

  const pct = prog ? Math.round((prog.done / prog.total) * 100) : 0;
  return (
    <div className="card" style={{ textAlign: "center", padding: "34px 20px" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {label}{prog ? ` — ${prog.done.toLocaleString()} of ${prog.total.toLocaleString()} stocks` : "…"}
      </div>
      <div className="muted small" style={{ marginBottom: 14 }}>
        Every stock is checked against 11 bullish conditions and 10 chart patterns. This runs in your browser, so it takes a few seconds.
      </div>
      <div className="scorebar" style={{ maxWidth: 420, margin: "0 auto", height: 8 }}>
        <div style={{ width: `${pct}%`, background: "var(--accent)", transition: "width 0.2s" }} />
      </div>
      <div className="faint" style={{ marginTop: 8 }}>{pct}%</div>
    </div>
  );
}
