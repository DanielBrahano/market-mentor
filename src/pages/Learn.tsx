import React, { useMemo, useState } from "react";
import { GLOSSARY } from "../content/glossary";
import { INDICATOR_DOCS } from "../content/education";
import { useStore } from "../state/store";
import { Seg } from "../components/ui";
import { IconSearch } from "../components/icons";

export default function Learn() {
  const [tab, setTab] = useState<"indicators" | "glossary">("indicators");
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
        <Seg options={[{ value: "indicators", label: "Indicators" }, { value: "glossary", label: "Glossary" }] as const} value={tab} onChange={setTab} />
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <IconSearch className="icon" style={{ width: 15, height: 15, position: "absolute", left: 10, top: 10, color: "var(--text-faint)" }} />
          <input className="input" style={{ width: "100%", paddingLeft: 32 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

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
