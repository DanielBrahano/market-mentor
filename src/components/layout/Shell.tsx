import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../../state/store";
import { DataSourceBadge } from "../ui";
import {
  IconBell, IconDashboard, IconLearn, IconLogout, IconPattern,
  IconScreener, IconSearch, IconSettings, IconWatchlist,
} from "../icons";
import { UNIVERSE } from "../../lib/data/universe";

const NAV = [
  { to: "/", label: "Dashboard", icon: IconDashboard, end: true },
  { to: "/screener", label: "Screener", icon: IconScreener },
  { to: "/patterns", label: "Pattern Explorer", icon: IconPattern },
  { to: "/learn", label: "Learn", icon: IconLearn },
  { to: "/watchlists", label: "Watchlists", icon: IconWatchlist },
  { to: "/alerts", label: "Alerts", icon: IconBell },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

const MOBILE_NAV = [NAV[0], NAV[1], NAV[4], NAV[5], NAV[6]];

function TickerSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return UNIVERSE.filter((u) => u.symbol.toLowerCase().includes(s) || u.name.toLowerCase().includes(s)).slice(0, 7);
  }, [q]);
  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
      <div className="row" style={{ gap: 0 }}>
        <IconSearch className="icon" style={{ width: 16, height: 16, position: "absolute", left: 11, color: "var(--text-faint)", pointerEvents: "none" }} />
        <input
          className="input"
          style={{ width: "100%", paddingLeft: 34 }}
          placeholder="Search stocks (e.g. NVDA, Apple)…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              nav(`/stock/${matches[0].symbol}`);
              setQ(""); setOpen(false);
            }
          }}
        />
      </div>
      {open && matches.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "var(--bg-elev)", border: "1px solid var(--border-strong)",
          borderRadius: 10, boxShadow: "var(--shadow)", zIndex: 80, overflow: "hidden",
        }}>
          {matches.map((m) => (
            <div
              key={m.symbol}
              onMouseDown={() => { nav(`/stock/${m.symbol}`); setQ(""); setOpen(false); }}
              className="row between"
              style={{ padding: "9px 13px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span><b>{m.symbol}</b> <span className="muted small">{m.name}</span></span>
              <span className="faint">{m.universe === "sp500" ? "S&P 500" : "Russell 2000"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout, unreadCount } = useStore();
  const [installEvent, setInstallEvent] = useState<any>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icons/icon.svg" alt="" />
          Market Mentor
        </div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end as any}>
              <n.icon className="icon" />
              {n.label}
              {n.to === "/alerts" && unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </NavLink>
          ))}
        </nav>
        {installEvent && (
          <div style={{ padding: "0 14px 10px" }}>
            <button className="btn sm" style={{ width: "100%" }} onClick={async () => { installEvent.prompt(); setInstallEvent(null); }}>
              Install app
            </button>
          </div>
        )}
        <div className="sidebar-footer">
          <div className="row between">
            <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>{user?.displayName}</span>
            <button className="btn ghost sm" onClick={logout} title="Sign out"><IconLogout className="icon" style={{ width: 15, height: 15 }} /></button>
          </div>
          <div style={{ marginTop: 6 }}>Educational software — not financial advice.</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <TickerSearch />
          <div className="spacer" />
          <DataSourceBadge />
        </header>
        <main className="page">{children}</main>
        <footer className="disclaimer">
          <b>Disclaimer:</b> Market Mentor is educational and analytical software. Nothing here is financial advice or a recommendation to buy or sell any security.
          Scanner scores, pattern detections and alerts are probabilistic observations about historical price behavior — they can and do fail. Always do your own research
          and consider consulting a licensed financial advisor before investing. This prototype displays simulated market data.
        </footer>
      </div>

      <nav className="bottom-nav">
        {MOBILE_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end as any}>
            <n.icon className="icon" />
            {n.label === "Pattern Explorer" ? "Patterns" : n.label}
            {n.to === "/alerts" && unreadCount > 0 && <span className="nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
