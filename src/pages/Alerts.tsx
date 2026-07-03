import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AlertRuleKind } from "../lib/types";
import { RULE_META } from "../lib/alerts/engine";
import { UNIVERSE } from "../lib/data/universe";
import { fmtTimeAgo, classNames } from "../lib/utils";
import { useStore } from "../state/store";
import { ConfidenceBadge, Drawer, EmptyState, Switch, Tooltip } from "../components/ui";
import { IconBell, IconPlus } from "../components/icons";

export default function Alerts() {
  const {
    alerts, alertRules, addRule, toggleRule, removeRule, markAllRead, markRead, clearAlerts,
    simulateAlertNow, settings, pushPermission, requestPush, updateNotifications, watchedSymbols,
  } = useStore();
  const [openAlert, setOpenAlert] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<AlertRuleKind>("cross-above-200ma");
  const [newSymbol, setNewSymbol] = useState<string>("ANY_WATCHLIST");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const nav = useNavigate();

  const active = alerts.find((a) => a.id === openAlert);

  const runCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    const n = await simulateAlertNow();
    setChecking(false);
    setCheckResult(n > 0 ? `${n} new alert${n === 1 ? "" : "s"} triggered.` : "No rules triggered right now — your watchlist stocks didn't meet any alert conditions in the latest data.");
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <h1>Alerts</h1>
          <div className="muted small">
            {settings.beginnerMode
              ? "Rules watch your stocks in the background and notify you when something technically interesting happens — with an explanation of what it means."
              : "Alert rules, delivery preferences and history."}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={runCheck} disabled={checking}>{checking ? "Checking…" : "Check rules now"}</button>
          <button className="btn primary" onClick={() => setShowNew(true)}><IconPlus className="icon" style={{ width: 14, height: 14 }} /> New rule</button>
        </div>
      </div>

      {checkResult && <div className="card small" style={{ padding: "10px 14px" }}>{checkResult}</div>}

      {/* Push setup banner */}
      {pushPermission !== "granted" && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <div className="row between wrap">
            <div>
              <b className="small">Enable notifications on this device</b>
              <div className="muted small" style={{ maxWidth: 560 }}>
                Get OS-level notifications when your watchlist stocks trigger alert rules — including when the app is installed to your home screen.
                {pushPermission === "denied" && " Notifications are currently blocked in your browser settings for this site."}
                {pushPermission === "unsupported" && " Your browser doesn't support notifications."}
              </div>
            </div>
            {pushPermission === "default" && <button className="btn primary" onClick={() => void requestPush()}>Enable notifications</button>}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
        {/* History */}
        <div className="card pad-0">
          <div className="row between" style={{ padding: "14px 16px 10px" }}>
            <h2>Alert history</h2>
            <div className="row">
              {alerts.some((a) => !a.read) && <button className="btn ghost sm" onClick={markAllRead}>Mark all read</button>}
              {alerts.length > 0 && <button className="btn ghost sm" onClick={() => { if (confirm("Clear all alert history?")) clearAlerts(); }}>Clear</button>}
            </div>
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: "0 16px 16px" }}>
              <EmptyState
                title="No alerts yet"
                hint="Alerts fire when a watchlist stock meets one of your rules — a fresh 200-day average cross, a MACD crossover, unusual volume, or a high-confidence bullish pattern. Click 'Check rules now' to evaluate immediately."
              />
            </div>
          ) : (
            <div>
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="condition-row"
                  style={{ padding: "12px 16px", cursor: "pointer", background: a.read ? undefined : "var(--accent-soft)" }}
                  onClick={() => { markRead(a.id); setOpenAlert(a.id); }}
                >
                  <IconBell className="icon" style={{ width: 17, height: 17, flexShrink: 0, marginTop: 2, color: a.read ? "var(--text-faint)" : "var(--accent)" }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <b className="small">{a.title}</b>
                      {a.confidence != null && <ConfidenceBadge confidence={a.confidence} />}
                    </div>
                    <div className="muted small">{a.body}</div>
                    <div className="faint">{fmtTimeAgo(a.createdAt)} · tap for plain-English explanation</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 14 }}>
          {/* Rules */}
          <div className="card">
            <div className="card-title">
              <h2>My rules</h2>
              <Tooltip text="Rules run automatically against fresh data (every ~90 seconds in this prototype; server-side in production). 'Any watchlist stock' applies the rule to everything you watch." />
            </div>
            {alertRules.length === 0 ? (
              <EmptyState title="No rules" hint="Add a rule to start receiving alerts." />
            ) : (
              <div className="stack" style={{ gap: 0 }}>
                {alertRules.map((r) => (
                  <div key={r.id} className="condition-row" style={{ alignItems: "center" }}>
                    <Switch checked={r.enabled} onChange={() => toggleRule(r.id)} />
                    <div style={{ flex: 1 }}>
                      <div className="small" style={{ fontWeight: 650 }}>{RULE_META[r.kind].label}</div>
                      <div className="faint">
                        {r.symbol === "ANY_WATCHLIST" ? `Any watchlist stock (${watchedSymbols.length})` : r.symbol}
                      </div>
                    </div>
                    <button className="btn ghost sm" onClick={() => removeRule(r.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notification prefs */}
          <div className="card stack">
            <div className="card-title" style={{ marginBottom: 0 }}>
              <h2>Notification preferences</h2>
            </div>
            <Switch checked={settings.notifications.inApp} onChange={(v) => updateNotifications({ inApp: v })} label="In-app alert feed" />
            <Switch
              checked={settings.notifications.push && pushPermission === "granted"}
              onChange={(v) => (v && pushPermission !== "granted" ? void requestPush() : updateNotifications({ push: v }))}
              label="Device notifications (web push)"
            />
            <Switch checked={settings.notifications.watchlistOnly} onChange={(v) => updateNotifications({ watchlistOnly: v })} label="Watchlist stocks only" />
            <Switch checked={settings.notifications.quietHours} onChange={(v) => updateNotifications({ quietHours: v })} label="Quiet mode (log alerts, don't notify)" />
            <label className="field">
              Minimum pattern confidence: {Math.round(settings.notifications.minConfidence * 100)}%
              <input
                type="range" min={40} max={90} step={5}
                value={settings.notifications.minConfidence * 100}
                onChange={(e) => updateNotifications({ minConfidence: Number(e.target.value) / 100 })}
              />
              <span className="faint" style={{ fontWeight: 400 }}>Pattern alerts only fire at or above this confidence. Higher = fewer but cleaner alerts.</span>
            </label>
            <p className="faint" style={{ margin: 0 }}>
              In this prototype, alert checks run in your browser against simulated data and deliver through the service worker — the same notification pipeline a production backend would push to.
            </p>
          </div>
        </div>
      </div>

      {/* Alert explanation drawer */}
      {active && (
        <Drawer title={active.title} onClose={() => setOpenAlert(null)}>
          <div className="stack">
            <div className="row wrap">
              <span className="badge accent">{RULE_META[active.ruleKind].label}</span>
              {active.confidence != null && <ConfidenceBadge confidence={active.confidence} />}
              <span className="faint">{fmtTimeAgo(active.createdAt)}</span>
            </div>
            <div>
              <h3 style={{ marginBottom: 6 }}>What happened</h3>
              <p className="small muted" style={{ margin: 0 }}>{active.body}</p>
            </div>
            <div>
              <h3 style={{ marginBottom: 6 }}>What it means (plain English)</h3>
              <p className="small muted" style={{ margin: 0 }}>{active.explanation}</p>
            </div>
            <div className="card" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
              <span className="small">This is a <b>possible</b> setup, not a guarantee or advice. Check the chart, the company, and the overall market before acting.</span>
            </div>
            <button className="btn primary" onClick={() => { setOpenAlert(null); nav(`/stock/${active.symbol}`); }}>
              Open {active.symbol} chart
            </button>
          </div>
        </Drawer>
      )}

      {/* New rule drawer */}
      {showNew && (
        <Drawer title="New alert rule" onClose={() => setShowNew(false)}>
          <div className="stack">
            <label className="field">
              Condition
              <select className="input" value={newKind} onChange={(e) => setNewKind(e.target.value as AlertRuleKind)}>
                {(Object.keys(RULE_META) as AlertRuleKind[]).map((k) => (
                  <option key={k} value={k}>{RULE_META[k].label}</option>
                ))}
              </select>
              <span className="faint" style={{ fontWeight: 400 }}>{RULE_META[newKind].help}</span>
            </label>
            <label className="field">
              Applies to
              <select className="input" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)}>
                <option value="ANY_WATCHLIST">Any watchlist stock</option>
                {UNIVERSE.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol} — {u.name}</option>)}
              </select>
            </label>
            <button className="btn primary" onClick={() => { addRule({ kind: newKind, symbol: newSymbol, enabled: true }); setShowNew(false); }}>
              Create rule
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
