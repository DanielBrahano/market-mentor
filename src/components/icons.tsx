/** Inline SVG icon set (stroke style, 24px grid). */
import type { CSSProperties } from "react";

type IconProps = { className?: string; style?: CSSProperties };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };

export const IconDashboard = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>
);
export const IconScreener = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M4 5h16M7 12h10M10 19h4"/></svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M3 20h18"/><path d="M5 16l4-5 3 3 4-7 3 4"/></svg>
);
export const IconPattern = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M3 17c2.5 0 2.5-9 5-9s2.5 6 5 6 2.5-10 5-10"/><path d="M3 21h18"/></svg>
);
export const IconLearn = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M12 4L3 8.5 12 13l9-4.5L12 4z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/></svg>
);
export const IconWatchlist = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5z"/></svg>
);
export const IconBell = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M18 9a6 6 0 10-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z"/><path d="M10 20a2.2 2.2 0 004 0"/></svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.56-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01a1.7 1.7 0 001-1.56V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.56h.01a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.56 1z"/></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M12 5v14M5 12h14"/></svg>
);
export const IconX = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M6 6l12 12M18 6L6 18"/></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M4 12.5l5 5L20 6.5"/></svg>
);
export const IconStar = (p: IconProps & { filled?: boolean }) => (
  <svg {...base} className={p.className} style={p.style} fill={p.filled ? "currentColor" : "none"}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5z"/></svg>
);
export const IconInfo = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
);
export const IconTrendUp = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
);
export const IconShare = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base} className={p.className} style={p.style}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.2c2.4.7 4 2.8 4 5.8"/></svg>
);
