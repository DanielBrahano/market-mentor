import React, { useMemo, useRef, useState } from "react";
import type { Candle, PatternHit } from "../../lib/types";
import { fmtPrice, fmtVolume } from "../../lib/utils";

/**
 * Main SVG price chart: candlestick or line mode, volume bars, arbitrary
 * overlay lines (moving averages, Bollinger, VWAP), crosshair with OHLCV
 * readout, and pattern key-point annotations.
 */

export interface OverlayLine {
  id: string;
  label: string;
  color: string;
  values: number[]; // aligned to candles, NaN where undefined
  dashed?: boolean;
}

interface Props {
  candles: Candle[];
  mode: "candles" | "line";
  overlays?: OverlayLine[];
  pattern?: PatternHit | null;
  /** Length of the full history the pattern indices refer to (visible candles
   *  are assumed to be the tail of that history). */
  historyLength?: number;
  height?: number;
  showVolume?: boolean;
}

const PAD = { top: 12, right: 56, bottom: 20, left: 8 };

export function PriceChart({ candles, mode, overlays = [], pattern, historyLength, height = 380, showVolume = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(800);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setWidth(Math.max(320, es[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const volH = showVolume ? Math.round(height * 0.16) : 0;
  const priceH = height - PAD.top - PAD.bottom - volH;
  const plotW = width - PAD.left - PAD.right;
  const n = candles.length;

  const { lo, hi, maxV } = useMemo(() => {
    let lo = Infinity, hi = -Infinity, maxV = 0;
    for (const c of candles) {
      lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); maxV = Math.max(maxV, c.v);
    }
    for (const ov of overlays) {
      const start = Math.max(0, ov.values.length - n);
      for (let i = start; i < ov.values.length; i++) {
        const v = ov.values[i];
        if (!isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
    }
    const padPct = (hi - lo) * 0.04 || hi * 0.02;
    return { lo: lo - padPct, hi: hi + padPct, maxV };
  }, [candles, overlays, n]);

  if (n === 0) return <div ref={ref} style={{ height }} className="empty">No chart data</div>;

  const x = (i: number) => PAD.left + ((i + 0.5) / n) * plotW;
  const y = (p: number) => PAD.top + (1 - (p - lo) / (hi - lo)) * priceH;
  const yv = (v: number) => PAD.top + priceH + 6 + (1 - v / maxV) * (volH - 8);
  const barW = Math.max(1.5, Math.min(14, (plotW / n) * 0.62));

  // Y grid: ~5 round levels
  const gridLevels = useMemo(() => {
    const range = hi - lo;
    const rawStep = range / 5;
    const mag = 10 ** Math.floor(Math.log10(rawStep));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => range / s <= 6) ?? rawStep;
    const levels: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v < hi; v += step) levels.push(v);
    return levels;
  }, [lo, hi]);

  // X labels: ~5 dates
  const xLabels = useMemo(() => {
    const count = Math.min(5, n);
    const out: { i: number; label: string }[] = [];
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1 || 1)) * (n - 1));
      const d = new Date(candles[i].t);
      const intraday = n > 1 && candles[1].t - candles[0].t < 3600_000 * 20;
      out.push({
        i,
        label: intraday
          ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
    return out;
  }, [candles, n]);

  const overlayPath = (values: number[]) => {
    // Align: overlay arrays may be longer than the visible candle slice.
    const offset = values.length - n;
    let d = "";
    for (let i = 0; i < n; i++) {
      const v = values[offset + i];
      if (isNaN(v)) continue;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    }
    return d;
  };

  const linePath = useMemo(() => {
    let d = "";
    candles.forEach((c, i) => { d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(c.c).toFixed(1)}`; });
    return d;
  }, [candles, width, lo, hi]);

  const areaPath = linePath ? `${linePath}L${x(n - 1).toFixed(1)},${(PAD.top + priceH).toFixed(1)}L${x(0).toFixed(1)},${(PAD.top + priceH).toFixed(1)}Z` : "";

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - PAD.left) / plotW) * n - 0.5);
    setHover(i >= 0 && i < n ? i : null);
  };

  const hc = hover != null ? candles[hover] : null;
  const lastClose = candles[n - 1].c;
  const upTrendColor = candles[n - 1].c >= candles[0].c;

  // Pattern annotation points mapped into the visible slice.
  const patternPoints = useMemo(() => {
    if (!pattern) return [];
    const offset = (historyLength ?? n) - n;
    return pattern.keyPoints.map((kp) => ({ ...kp, vis: kp.index - offset }));
  }, [pattern, historyLength, n]);

  return (
    <div ref={ref}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* grid */}
        {gridLevels.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth={1} />
            <text x={width - PAD.right + 6} y={y(g) + 4} fontSize={11} fill="var(--text-faint)">{fmtPrice(g)}</text>
          </g>
        ))}
        {xLabels.map((xl) => (
          <text key={xl.i} x={x(xl.i)} y={height - 5} fontSize={11} fill="var(--text-faint)" textAnchor="middle">{xl.label}</text>
        ))}

        {/* volume */}
        {showVolume && candles.map((c, i) => (
          <rect
            key={i}
            x={x(i) - barW / 2}
            y={yv(c.v)}
            width={barW}
            height={PAD.top + priceH + volH - 2 - yv(c.v)}
            fill={c.c >= c.o ? "var(--up)" : "var(--down)"}
            opacity={0.32}
          />
        ))}

        {/* price */}
        {mode === "line" ? (
          <>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={upTrendColor ? "var(--up)" : "var(--down)"} stopOpacity={0.22} />
                <stop offset="1" stopColor={upTrendColor ? "var(--up)" : "var(--down)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#areaFill)" />
            <path d={linePath} fill="none" stroke={upTrendColor ? "var(--up)" : "var(--down)"} strokeWidth={1.8} />
          </>
        ) : (
          candles.map((c, i) => {
            const up = c.c >= c.o;
            const col = up ? "var(--up)" : "var(--down)";
            const bodyTop = y(Math.max(c.o, c.c));
            const bodyH = Math.max(1, Math.abs(y(c.o) - y(c.c)));
            return (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} />
                <rect x={x(i) - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={up ? col : col} opacity={up ? 0.95 : 0.95} rx={0.5} />
              </g>
            );
          })
        )}

        {/* overlays */}
        {overlays.map((ov) => (
          <path key={ov.id} d={overlayPath(ov.values)} fill="none" stroke={ov.color} strokeWidth={1.4} strokeDasharray={ov.dashed ? "4 4" : undefined} opacity={0.9} />
        ))}

        {/* last price line */}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(lastClose)} y2={y(lastClose)} stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
        <rect x={width - PAD.right + 1} y={y(lastClose) - 9} width={PAD.right - 3} height={18} rx={4} fill="var(--accent)" />
        <text x={width - PAD.right + 6} y={y(lastClose) + 4} fontSize={11} fontWeight={700} fill="#fff">{fmtPrice(lastClose)}</text>

        {/* pattern key points */}
        {pattern && patternPoints.map((kp, i) => {
          const vi = kp.vis;
          if (vi == null || vi < 0 || vi >= n) return null;
          return (
            <g key={i}>
              <circle cx={x(vi)} cy={y(kp.price)} r={5} fill="var(--purple)" opacity={0.9} />
              <circle cx={x(vi)} cy={y(kp.price)} r={9} fill="none" stroke="var(--purple)" opacity={0.45} />
              <text x={x(vi)} y={y(kp.price) - 13} fontSize={10.5} fontWeight={600} fill="var(--purple)" textAnchor="middle">{kp.role}</text>
            </g>
          );
        })}

        {/* crosshair */}
        {hc && hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + priceH + volH} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={PAD.left} x2={width - PAD.right} y1={y(hc.c)} y2={y(hc.c)} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="3 3" />
            {(() => {
              const boxW = 168, boxH = 86;
              const bx = Math.min(width - PAD.right - boxW - 4, Math.max(PAD.left + 4, x(hover) + 12));
              const by = PAD.top + 4;
              const d = new Date(hc.t);
              const intraday = n > 1 && candles[1].t - candles[0].t < 3600_000 * 20;
              return (
                <g>
                  <rect x={bx} y={by} width={boxW} height={boxH} rx={7} fill="var(--bg-elev)" stroke="var(--border-strong)" />
                  <text x={bx + 10} y={by + 17} fontSize={11} fontWeight={700} fill="var(--text)">
                    {intraday ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </text>
                  <text x={bx + 10} y={by + 34} fontSize={11} fill="var(--text-dim)">O {fmtPrice(hc.o)}   H {fmtPrice(hc.h)}</text>
                  <text x={bx + 10} y={by + 50} fontSize={11} fill="var(--text-dim)">L {fmtPrice(hc.l)}   C <tspan fontWeight={700} fill={hc.c >= hc.o ? "var(--up)" : "var(--down)"}>{fmtPrice(hc.c)}</tspan></text>
                  <text x={bx + 10} y={by + 66} fontSize={11} fill="var(--text-dim)">Vol {fmtVolume(hc.v)}</text>
                  <text x={bx + 10} y={by + 80} fontSize={10.5} fill={hc.c >= hc.o ? "var(--up)" : "var(--down)"}>{(((hc.c - hc.o) / hc.o) * 100).toFixed(2)}% bar</text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}