import React, { useMemo, useState } from "react";
import { GLOSSARY } from "../content/glossary";
import { INDICATOR_DOCS } from "../content/education";
import { MAX_SCORE, PATTERN_BONUS_MAX, SCAN_CONDITIONS } from "../lib/scanner/engine";
import { RULE_META } from "../lib/alerts/engine";
import { useStore } from "../state/store";
import { Seg, Tooltip } from "../components/ui";
import { IconSearch } from "../components/icons";

export default function Learn() {
  const [tab, setTab] = useState<"how" | "indicators" | "glossary">("how");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { settings } = useStore();

  const terms = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return GLOSSARY;
    return GLOSSARY.filter((t) => t.term.toLowerCase().includes(s) || t.short.toLowerCase().includes(s) || t.explanation.toLowerCase().includes(s));
  }, [q]);

  const docs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return INDICATOR_DOCS;
    return INDICATOR_DOCS.filter((d) => d.name.toLowerCase().includes(s) || d.what.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <h1>Learn</h1>
        <div className="muted small">
          {settings.beginnerMode
            ? "Everything the app measures, explained in plain English — what it is, why traders care, what bullish and bearish look like, and where it fools people."
            : "Indicator reference and glossary."}
        </div>
      </div>

      <div className="row wrap">
        <Seg options={[{ value: "how", label: "How it works" }, { value: "indicators", label: "Indicators" }, { value: "glossary", label: "Glossary" }] as const} value={tab} onChange={setTab} />
        {tab !== "how" && (
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <IconSearch className="icon" style={{ width: 15, height: 15, position: "absolute", left: 10, top: 10, color: "var(--text-faint)" }} />
            <input className="input" style={{ width: "100%", paddingLeft: 32 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </div>

      {tab === "how" && <HowItWorks />}

      {tab === "indicators" && (
        <div className="stack">
          {docs.map((d) => (
            <div key={d.id} className="card">
              <div className="row between" style={{ cursor: "pointer" }} onClick={() => setOpen(open === d.id ? null : d.id)}>
                <h3>{d.name}</h3>
                <span className="faint">{open === d.id ? "▲" : "▼"}</span>
              </div>
              <p className="small muted" style={{ margin: "6px 0 0" }}>{d.what}</p>
              {open === d.id && (
                <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                  <div className="small"><b>Why traders use it:</b> <span className="muted">{d.why}</span></div>
                  <div className="small"><b style={{ color: "var(--up)" }}>Bullish behavior:</b> <span className="muted">{d.bullish}</span></div>
                  <div className="small"><b style={{ color: "var(--down)" }}>Bearish behavior:</b> <span className="muted">{d.bearish}</span></div>
                  <div className="small"><b style={{ color: "var(--warn)" }}>Limitations & false signals:</b> <span className="muted">{d.limitations}</span></div>
                  <div className="small" style={{ background: "var(--bg-input)", padding: "10px 12px", borderRadius: 8 }}>
                    <b>Mini example:</b> <span className="muted">{d.example}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "glossary" && (
        <div className="grid cols-2">
          {terms.map((t) => (
            <div key={t.id} className="card" id={t.id}>
              <h3>{t.term}</h3>
              <p className="small" style={{ margin: "6px 0", fontWeight: 600, color: "var(--accent)" }}>{t.short}</p>
              <p className="small muted" style={{ margin: "0 0 8px" }}>
                {settings.beginnerMode ? t.beginner : t.explanation}
              </p>
              {!settings.beginnerMode && <p className="small muted" style={{ margin: "0 0 8px" }}>{t.beginner}</p>}
              <div className="small" style={{ background: "var(--bg-input)", padding: "8px 11px", borderRadius: 8 }}>
                <b>Example:</b> <span className="muted">{t.example}</span>
              </div>
            </div>
          ))}
          {terms.length === 0 && <p className="muted">No matching terms.</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Plain-English methodology page. Weights and conditions are pulled straight
 * from the scanner source (SCAN_CONDITIONS / MAX_SCORE / PATTERN_BONUS_MAX),
 * so this page can never drift from the algorithm the app actually runs.
 */
function HowItWorks() {
  const sorted = [...SCAN_CONDITIONS].sort((a, b) => b.weight - a.weight);
  const strongPts = Math.round(MAX_SCORE * 0.5);
  const developingPts = Math.round(MAX_SCORE * 0.3);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack" style={{ gap: 10 }}>
        <h2>How the scanner works</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Market Mentor's scanner is deliberately a <b>transparent, weighted checklist</b> — not a black-box AI or a secret formula.
          Every stock is checked against {SCAN_CONDITIONS.length} bullish conditions. Each condition that's true adds a fixed number of points.
          The <b>setup score is simply the sum of those points</b> — nothing hidden. You can see the exact breakdown for any stock on its page under
          <b> "See full checklist."</b>
        </p>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="card" style={{ margin: 0, flex: 1, minWidth: 130, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 750 }} className="mono">{MAX_SCORE}</div>
            <div className="faint">max base score</div>
          </div>
          <div className="card" style={{ margin: 0, flex: 1, minWidth: 130, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 750 }} className="mono">+{PATTERN_BONUS_MAX}</div>
            <div className="faint">pattern bonus (max)</div>
          </div>
          <div className="card" style={{ margin: 0, flex: 1, minWidth: 130, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 750 }} className="mono">{SCAN_CONDITIONS.length}</div>
            <div className="faint">conditions checked</div>
          </div>
        </div>
      </div>

      <div className="card pad-0">
        <div className="card-title" style={{ padding: "14px 16px 0" }}>
          <h2>The {SCAN_CONDITIONS.length} conditions & their weights</h2>
          <Tooltip text="These are the exact point values the live scanner uses, pulled from the same source code. Higher weight = stronger bullish signal." />
        </div>
        <div style={{ padding: "10px 0 4px" }}>
          {sorted.map((c) => (
            <div key={c.id} className="condition-row" style={{ alignItems: "center", padding: "10px 16px" }}>
              <span className="badge up mono" style={{ flexShrink: 0, minWidth: 46, justifyContent: "center" }}>+{c.weight}</span>
              <div style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 650 }}>{c.label}</div>
                <div className="faint">{c.help}</div>
              </div>
            </div>
          ))}
          <div className="condition-row" style={{ alignItems: "center", padding: "10px 16px" }}>
            <span className="badge accent mono" style={{ flexShrink: 0, minWidth: 46, justifyContent: "center" }}>+{PATTERN_BONUS_MAX}</span>
            <div style={{ minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 650 }}>Bullish chart pattern bonus</div>
              <div className="faint">Up to {PATTERN_BONUS_MAX} extra points, scaled by how cleanly a bullish pattern (flag, double bottom, ascending triangle…) matches. See Pattern Explorer for how each is detected.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2>What the score means</h2>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="badge up" style={{ flexShrink: 0 }}>Strong setup</span>
            <span className="small muted">Score at or above 50% of max (~{strongPts}+ points). The most conditions are lining up at once.</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="badge warn" style={{ flexShrink: 0 }}>Developing setup</span>
            <span className="small muted">Score between 30% and 50% (~{developingPts}–{strongPts}). Some pieces are in place, others aren't yet.</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="badge neutral" style={{ flexShrink: 0 }}>Weak / early</span>
            <span className="small muted">Below 30% (~under {developingPts}). Few bullish conditions are true right now.</span>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2>Alerts use the same logic</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Alert rules watch for individual conditions flipping true on your watchlist stocks — checked in-app, and (if you enable phone notifications) on our server every 15 minutes during market hours. The available triggers:
        </p>
        <div className="stack" style={{ gap: 0 }}>
          {(Object.keys(RULE_META) as (keyof typeof RULE_META)[]).map((k) => (
            <div key={k} className="condition-row" style={{ padding: "9px 0" }}>
              <div>
                <div className="small" style={{ fontWeight: 650 }}>{RULE_META[k].label}</div>
                <div className="faint">{RULE_META[k].help}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
        <h2>Honest limitations</h2>
        <p className="small" style={{ margin: 0 }}>
          This scanner measures <b>technical momentum and trend</b> — it knows nothing about a company's earnings, news, or valuation. A high score means many bullish
          technical conditions are true <i>right now</i>; it is <b>not</b> a prediction and <b>not</b> advice. These signals fail regularly, especially in weak markets.
          Use the score as a reason to <i>investigate</i> a stock, then do your own research. Nothing here is a recommendation to buy or sell.
        </p>
      </div>
    </div>
  );
}
