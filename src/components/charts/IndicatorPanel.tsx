import React, { useMemo, useRef, useState } from "react";

/**
 * Lower indicator panel (RSI / MACD / Stochastic): compact SVG panel with
 * reference lines and optional histogram.
 */

export interface PanelSeries {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  title: string;
  series: PanelSeries[];
  histogram?: number[];
  /** horizontal reference lines, e.g. RSI 30/50/70 */
  refLines?: { value: number; label?: string; color?: string }[];
  /** fixed y-domain, e.g. [0,100] for RSI */
  domain?: [number, number];
  /** number of visible bars (tail) */
  visible: number;
  height?: number;
}

const PAD = { top: 8, right: 56, bottom: 4, left: 8 };

export function IndicatorPanel({ title, series, histogram, refLines = [], domain, visible, height = 110 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setWidth(Math.max(320, es[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = visible;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const [lo, hi] = useMemo(() => {
    if (domain) return domain;
    let lo = Infinity, hi = -Infinity;
    const scan = (vals: number[]) => {
      for (let i = Math.max(0, vals.length - n); i < vals.length; i++) {
        const v = vals[i];
        if (!isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
    };
    series.forEach((s) => scan(s.values));
    if (histogram) scan(histogram);
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.12 || 1;
    return [lo - pad, hi + pad];
  }, [series, histogram, domain, n]);

  const x = (i: number) => PAD.left + ((i + 0.5) / n) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
  const barW = Math.max(1, Math.min(8, (plotW / n) * 0.5));

  const path = (vals: number[]) => {
    const off = vals.length - n;
    let d = "";
    for (let i = 0; i < n; i++) {
      const v = vals[off + i];
      if (isNaN(v)) continue;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    }
    return d;
  };

  const lastVal = (vals: number[]) => {
    for (let i = vals.length - 1; i >= 0; i--) if (!isNaN(vals[i])) return vals[i];
    return NaN;
  };

  return (
    <div ref={ref}>
      <div className="row between" style={{ padding: "2px 2px 1px" }}>
        <span className="faint" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
        <span className="row" style={{ gap: 8 }}>
          {series.map((s) => (
            <span key={s.label} className="faint mono" style={{ color: s.color }}>
              {s.label} {isNaN(lastVal(s.values)) ? "—" : lastVal(s.values).toFixed(1)}
            </span>
          ))}
        </span>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} style={{ height }}>
        {refLines.map((r) => (
          <g key={r.value}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(r.value)} y2={y(r.value)} stroke={r.color ?? "var(--border-strong)"} strokeWidth={1} strokeDasharray="3 4" opacity={0.8} />
            <text x={width - PAD.right + 6} y={y(r.value) + 4} fontSize={10.5} fill="var(--text-faint)">{r.label ?? r.value}</text>
          </g>
        ))}
        {histogram && (() => {
          const off = histogram.length - n;
          return Array.from({ length: n }, (_, i) => {
            const v = histogram[off + i];
            if (isNaN(v)) return null;
            const y0 = y(0), y1 = y(v);
            return <rect key={i} x={x(i) - barW / 2} y={Math.min(y0, y1)} width={barW} height={Math.max(1, Math.abs(y1 - y0))} fill={v >= 0 ? "var(--up)" : "var(--down)"} opacity={0.45} />;
          });
        })()}
        {series.map((s) => (
          <path key={s.label} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}
