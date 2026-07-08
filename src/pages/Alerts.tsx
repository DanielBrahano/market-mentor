import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AlertRuleKind } from "../lib/types";
import { RULE_META } from "../lib/alerts/engine";
import { disablePush, enablePush, pushStatus, sendTestPush, syncPush, type PushStatus } from "../lib/pushClient";
import { REAL_UNIVERSE } from "../lib/data/universe";
import { fmtTimeAgo } from "../lib/utils";
import { useStore } from "../state/store";
import { ConfidenceBadge, Drawer, EmptyState, Switch, Tooltip } from "../components/ui";
import { IconBell, IconPlus } from "../components/icons";

export default function Alerts() {
  const {
    alerts, alertRules, addRule, toggleRule, removeRule, markAllRead, markRead, clearAlerts,
    simulateAlertNow, settings, updateNotifications, watchedSymbols,
  } = useStore();
  const [openAlert, setOpenAlert] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<AlertRuleKind>("cross-above-200ma");
  const [newSymbol, setNewSymbol] = useState<string>("ANY_WATCHLIST");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => { void pushStatus().then(setPush); }, []);
  // Keep the relay's symbol list in sync with the watchlists.
  useEffect(() => { if (push === "on") void syncPush(watchedSymbols); }, [push, watchedSymbols.join(",")]);

  const onEnablePush = async () => {
    setPushBusy(true); setPushMsg(null);
    const r = await enablePush(watchedSymbols);
    setPushBusy(false);
    if (r.ok) { setPush("on"); setPushMsg("Enabled! Your watchlist is checked every 15 minutes during market hours — even when the app is closed."); }
    else setPushMsg(r.reason ?? "Could not enable notifications.");
    void pushStatus().then(setPush);
  };

  const onDisablePush = async () => {
    setPushBusy(true); setPushMsg(null);
    await disablePush();
    setPushBusy(false); setPush("off"); setPushMsg("Push notifications turned off.");
  };

  const onTestPush = async () => {
    setPushBusy(true); setPushMsg(null);
    const ok = await sendTestPush();
    setPushBusy(false);
    setPushMsg(ok ? "Test sent — a notification should appear on this device within a few seconds." : "Test failed — try disabling and re-enabling push.");
  };

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
              ? "Rules watch your stocks in the background and flag it here when something technically interesting happens — with an explanation of what it means."
              : "Alert rules, thresholds and history."}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={runCheck} disabled={checking}>{checking ? "Checking…" : "Check rules now"}</button>
          <button className="btn primary" onClick={() => setShowNew(true)}><IconPlus className="icon" style={{ width: 14, height: 14 }} /> New rule</button>
        </div>
      </div>

      {checkResult && <div className="card small" style={{ padding: "10px 14px" }}>{checkResult}</div>}

      <div className="grid main-split narrow">
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
              <Tooltip text="Rules run automatically against fresh data every few minutes while the app is open. 'Any watchlist stock' applies the rule to everything you watch." />
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

          {/* Alert threshold */}
          <div className="card stack">
            <div className="card-title" style={{ marginBottom: 0 }}>
              <h2>Alert threshold</h2>
            </div>
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
              In-app alerts are checked while the app is open. Turn on phone notifications below to get alerts even when it's closed.
            </p>
          </div>

          {/* Phone notifications (real web push) */}
          <div className="card stack">
            <div className="card-title" style={{ marginBottom: 0 }}>
              <h2>Phone notifications</h2>
              <Tooltip text="Our server checks your watchlist stocks every 15 minutes during market hours (pre-market through after-hours) and sends a notification to this device when a rule triggers — MA crosses, MACD crossovers, unusual volume, RSI recovery or 60-day breakouts. Works even when the app is closed." />
            </div>
            {push === null && <span className="faint">Checking…</span>}
            {push === "unsupported" && (
              <p className="small muted" style={{ margin: 0 }}>
                This browser doesn't support push. On iPhone/iPad: open the site in Safari, tap <b>Share → Add to Home Screen</b>, then open the installed app and come back here.
              </p>
            )}
            {push === "denied" && (
              <p className="small muted" style={{ margin: 0 }}>
                Notifications are blocked for this site. Allow them in your browser's site settings, then reload.
              </p>
            )}
            {push === "off" && (
              <>
                <p className="small muted" style={{ margin: 0 }}>
                  Get real alerts on this device — even with the app closed. Your {watchedSymbols.length} watchlist stock{watchedSymbols.length === 1 ? "" : "s"} will be monitored every 15 minutes during market hours.
                </p>
                <button className="btn primary" disabled={pushBusy} onClick={onEnablePush}>
                  {pushBusy ? "Enabling…" : "Enable notifications"}
                </button>
              </>
            )}
            {push === "on" && (
              <>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge up">Active</span>
                  <span className="faint">Monitoring {watchedSymbols.length} watchlist stock{watchedSymbols.length === 1 ? "" : "s"}</span>
                </div>
                <div className="row">
                  <button className="btn sm" disabled={pushBusy} onClick={onTestPush}>Send test notification</button>
                  <button className="btn ghost sm" disabled={pushBusy} onClick={onDisablePush}>Turn off</button>
                </div>
              </>
            )}
            {pushMsg && <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>{pushMsg}</p>}
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
                {REAL_UNIVERSE.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol} — {u.name}</option>)}
              </select>
              <span className="faint" style={{ fontWeight: 400 }}>Single-stock rules list the curated companies; watchlist rules cover anything you add from the full scan.</span>
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
