import React, { useState } from "react";
import { FRESHNESS_HELP, provider } from "../lib/data/provider";
import { useStore } from "../state/store";
import { Seg, Switch, Tooltip } from "../components/ui";
import { IconUsers } from "../components/icons";

export default function Settings() {
  const { user, users, settings, updateSettings, myInviteCode, logout, pushPermission, requestPush, updateNotifications } = useStore();
  const [copied, setCopied] = useState(false);
  const p = provider();

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760 }}>
      <div>
        <h1>Settings</h1>
        <div className="muted small">Appearance, notifications, data source and account.</div>
      </div>

      <div className="card stack">
        <h2>Appearance</h2>
        <div className="row between">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Theme</div>
            <div className="faint">Dark mode is the default for chart readability.</div>
          </div>
          <Seg
            options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] as const}
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
          />
        </div>
        <div className="row between">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Beginner mode <Tooltip text="Simplifies wording across the app: longer plain-English explanations on dashboards, glossary entries in 'explain like I'm new' style, and extra context on alerts." /></div>
            <div className="faint">Plain-English explanations everywhere. Recommended if you're new to trading terms.</div>
          </div>
          <Switch checked={settings.beginnerMode} onChange={(v) => updateSettings({ beginnerMode: v })} />
        </div>
      </div>

      <div className="card stack">
        <h2>Notifications</h2>
        <div className="row between">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Device notifications</div>
            <div className="faint">
              Status: {pushPermission === "granted" ? "enabled" : pushPermission === "denied" ? "blocked in browser settings" : pushPermission === "unsupported" ? "not supported by this browser" : "not enabled yet"}
            </div>
          </div>
          {pushPermission === "default" && <button className="btn" onClick={() => void requestPush()}>Enable</button>}
          {pushPermission === "granted" && (
            <Switch checked={settings.notifications.push} onChange={(v) => updateNotifications({ push: v })} />
          )}
        </div>
        <p className="faint" style={{ margin: 0 }}>
          Architecture note: notifications are delivered through the service worker. In this prototype the alert engine runs in your browser against simulated data;
          in production a backend scans the market and sends Web Push messages to the same service worker — no app changes needed. Install the app (Add to Home Screen)
          to receive notifications like a native app.
        </p>
      </div>

      <div className="card stack">
        <h2>Market data</h2>
        <div className="row between">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Active provider: {p.name}</div>
            <div className="faint">{FRESHNESS_HELP[p.freshness]}</div>
          </div>
          <span className="badge warn">{p.freshness}</span>
        </div>
        <p className="faint" style={{ margin: 0 }}>
          The app is built on a provider abstraction — quotes, candles and fundamentals all flow through one interface. Swapping in a real vendor
          (Polygon, Finnhub, Alpaca…) is a config change, and every screen already labels data freshness honestly.
        </p>
      </div>

      <div className="card stack">
        <h2><IconUsers className="icon" style={{ width: 17, height: 17, verticalAlign: -3 }} /> Friends & sharing</h2>
        <div className="row between wrap">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Your invite code</div>
            <div className="faint">Share this with a friend so they can create an account.</div>
          </div>
          <div className="row">
            <code style={{ background: "var(--bg-input)", padding: "7px 12px", borderRadius: 8, fontWeight: 700, letterSpacing: "0.03em" }}>{myInviteCode}</code>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(myInviteCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <div className="faint">{users.length} account{users.length === 1 ? "" : "s"} on this device. Watchlists, alerts and settings are per-user. Stock pages are shareable by URL; shared watchlists are on the roadmap.</div>
      </div>

      <div className="card stack">
        <h2>Account</h2>
        <div className="row between">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>{user?.displayName} <span className="faint">@{user?.username}</span></div>
            <div className="faint">Joined {user ? new Date(user.createdAt).toLocaleDateString() : ""}</div>
          </div>
          <button className="btn danger" onClick={logout}>Sign out</button>
        </div>
      </div>

      <p className="faint">
        Market Mentor is educational and analytical software, not financial advice. Signals are probabilistic observations, never guarantees. Always do your own research.
      </p>
    </div>
  );
}
