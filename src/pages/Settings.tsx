import React from "react";
import { FRESHNESS_HELP, provider } from "../lib/data/provider";
import { getDataSourcePreference, liveFellBack, setDataSourcePreference } from "../lib/data/select";
import { REAL_UNIVERSE, UNIVERSE } from "../lib/data/universe";
import { useStore } from "../state/store";
import { Seg, Switch, Tooltip } from "../components/ui";

export default function Settings() {
  const { settings, updateSettings } = useStore();
  const p = provider();
  const pref = getDataSourcePreference();

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760 }}>
      <div>
        <h1>Settings</h1>
        <div className="muted small">Appearance, data source and about. No account needed — your watchlists and alerts live in this browser.</div>
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
        <div className="row between wrap">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Your name</div>
            <div className="faint">Just for the dashboard greeting.</div>
          </div>
          <input
            className="input" style={{ width: 180 }} maxLength={24}
            value={settings.displayName}
            onChange={(e) => updateSettings({ displayName: e.target.value || "Friend" })}
          />
        </div>
      </div>

      <div className="card stack">
        <h2>Market data</h2>
        <div className="row between wrap">
          <div style={{ maxWidth: 440 }}>
            <div className="small" style={{ fontWeight: 650 }}>Data source</div>
            <div className="faint">
              <b>Live</b> shows real prices (incl. pre/post market) for {REAL_UNIVERSE.length.toLocaleString()} real companies — the full S&P 500 plus ~1,900 small caps — via our data relay.
              The scanner sweeps the S&P 500 by default; use <b>Deep scan</b> on the Screener to sweep the small caps too.{" "}
              <b>Simulated</b> uses realistic generated data for the same {UNIVERSE.length.toLocaleString()}-stock universe.
            </div>
          </div>
          <Seg
            options={[{ value: "live", label: "Live" }, { value: "sim", label: "Simulated" }] as const}
            value={pref}
            onChange={(v) => { if (v !== pref) setDataSourcePreference(v); }}
          />
        </div>
        <div className="row between">
          <div>
            <div className="small" style={{ fontWeight: 650 }}>Active now: {p.name}</div>
            <div className="faint">{FRESHNESS_HELP[p.freshness]}</div>
          </div>
          <span className={p.freshness === "simulated" ? "badge warn" : "badge up"}>{p.freshness}</span>
        </div>
        {liveFellBack() && (
          <div className="card small" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)", margin: 0 }}>
            Live data was selected but the data relay couldn't be reached, so this session is running on simulated data. It will retry next time you open the app.
          </div>
        )}
        <p className="faint" style={{ margin: 0 }}>
          Everything flows through one provider interface — quotes, candles, fundamentals. Changing the source never changes how the scanner, patterns or education work.
          In live mode, fundamentals (P/E, revenue…) are approximations and are labeled as such; prices and charts are real.
        </p>
      </div>

      <div className="card stack">
        <h2>About</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Market Mentor scans the market for possible bullish setups, explains every signal in plain English, and teaches the patterns and indicators it uses.
          It is educational and analytical software — <b>not financial advice</b>. Signals are probabilistic observations, never guarantees. Always do your own research.
        </p>
        <p className="faint" style={{ margin: 0 }}>
          Open to everyone — no accounts. Your watchlists, alert rules and settings are saved in this browser only.
        </p>
      </div>
    </div>
  );
}
