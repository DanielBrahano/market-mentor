import React from "react";
import type { Candle } from "../../lib/types";

/** Tiny inline sparkline for cards and tables. */
export function Sparkline({ values, width = 110, height = 34, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const up = values[values.length - 1] >= values[0];
  const col = color ?? (up ? "var(--up)" : "var(--down)");
  const x = (i: number) => (i / (values.length - 1)) * (width - 2) + 1;
  const y = (v: number) => 2 + (1 - (v - lo) / (hi - lo || 1)) * (height - 4);
  let d = "";
  values.forEach((v, i) => { d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
  const area = `${d}L${x(values.length - 1)},${height}L${x(0)},${height}Z`;
  const gid = `sp${Math.abs(Math.round(lo * 7 + hi * 13 + values.length))}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity={0.25} />
          <stop offset="1" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={col} strokeWidth={1.5} />
    </svg>
  );
}

export function MiniCandles({ candles, width = 120, height = 44 }: { candles: Candle[]; width?: number; height?: number }) {
  if (candles.length === 0) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
  const n = candles.length;
  const x = (i: number) => ((i + 0.5) / n) * width;
  const y = (p: number) => 2 + (1 - (p - lo) / (hi - lo || 1)) * (height - 4);
  const bw = Math.max(1, (width / n) * 0.6);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? "var(--up)" : "var(--down)";
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={0.8} />
            <rect x={x(i) - bw / 2} y={y(Math.max(c.o, c.c))} width={bw} height={Math.max(0.8, Math.abs(y(c.o) - y(c.c)))} fill={col} />
          </g>
        );
      })}
    </svg>
  );
}

/** Educational candle-shape rendering from normalized OHLC values. */
export function CandleShapes({ shapes, width = 120, height = 90 }: { shapes: { o: number; h: number; l: number; c: number }[]; width?: number; height?: number }) {
  const n = shapes.length;
  const cw = width / n;
  const y = (v: number) => 6 + (1 - v) * (height - 12);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {shapes.map((s, i) => {
        const cx = cw * i + cw / 2;
        const up = s.c >= s.o;
        const col = up ? "var(--up)" : "var(--down)";
        const bw = Math.min(26, cw * 0.5);
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(s.h)} y2={y(s.l)} stroke={col} strokeWidth={2} strokeLinecap="round" />
            <rect x={cx - bw / 2} y={y(Math.max(s.o, s.c))} width={bw} height={Math.max(3, Math.abs(y(s.o) - y(s.c)))} fill={col} rx={2} />
          </g>
        );
      })}
    </svg>
  );
}
