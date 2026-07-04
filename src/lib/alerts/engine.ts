import type { AlertEvent, AlertRule, AlertRuleKind } from "../types";
import { scanUniverse } from "../scanner/engine";
import { uid } from "../utils";

/**
 * Alert engine.
 *
 * In production this runs as a backend background job that evaluates rules
 * against fresh data and delivers via Web Push. In the prototype the same
 * rule evaluation runs client-side against the simulated feed, and delivery
 * goes through the service worker so the notification UX is identical.
 */

export const RULE_META: Record<AlertRuleKind, { label: string; help: string }> = {
  "cross-above-200ma": {
    label: "Crosses above 200-day average",
    help: "Fires when price closes above its 200-day moving average — a widely watched long-term trend signal.",
  },
  "cross-above-50ma": {
    label: "Crosses above 50-day average",
    help: "Fires when price closes above its 50-day moving average — often the start of a new medium-term leg.",
  },
  "macd-bull-cross": {
    label: "MACD bullish crossover",
    help: "Fires when the MACD line crosses above its signal line — momentum turning positive.",
  },
  "unusual-volume": {
    label: "Unusual volume (≥1.5× average)",
    help: "Fires when volume runs at least 1.5× its 20-day average — someone is unusually interested.",
  },
  "rsi-recovery": {
    label: "RSI recovery above 50",
    help: "Fires when RSI climbs back above 50 after a dip — momentum recovering.",
  },
  "bullish-pattern": {
    label: "High-confidence bullish pattern",
    help: "Fires when the pattern engine detects a bullish chart pattern above your confidence threshold.",
  },
  "breakout-high": {
    label: "Breakout above 60-day high",
    help: "Fires when price closes above its highest level of the last ~3 months.",
  },
};

const RULE_TO_CONDITION: Partial<Record<AlertRuleKind, string>> = {
  "cross-above-200ma": "cross-200",
  "cross-above-50ma": "cross-50",
  "macd-bull-cross": "macd-cross",
  "unusual-volume": "rel-volume",
  "rsi-recovery": "rsi-recovery",
  "breakout-high": "breakout",
};

/**
 * Evaluate all enabled rules against the latest scan and produce alert events.
 * `watchlistSymbols` expands rules with symbol === "ANY_WATCHLIST".
 * `seen` prevents duplicate alerts for the same (rule, symbol, day).
 */
export async function evaluateRules(
  rules: AlertRule[],
  watchlistSymbols: string[],
  minConfidence: number,
  seen: Set<string>,
): Promise<AlertEvent[]> {
  const { results } = await scanUniverse();
  const bySymbol = new Map(results.map((r) => [r.symbol, r]));
  const events: AlertEvent[] = [];
  const today = new Date().toDateString();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const symbols = rule.symbol === "ANY_WATCHLIST" ? watchlistSymbols : [rule.symbol];
    for (const sym of symbols) {
      const res = bySymbol.get(sym);
      if (!res) continue;
      const dedupeKey = `${rule.kind}:${sym}:${today}`;
      if (seen.has(dedupeKey)) continue;

      if (rule.kind === "bullish-pattern") {
        const p = res.patterns.find((x) => x.confidence >= minConfidence);
        if (p) {
          seen.add(dedupeKey);
          events.push({
            id: uid(),
            ruleKind: rule.kind,
            symbol: sym,
            title: `${sym}: possible ${p.label}`,
            body: `${p.label} detected with ${Math.round(p.confidence * 100)}% confidence.`,
            explanation: `${p.explanation} Pattern detection is probabilistic — treat this as a reason to look closer, not a guarantee.`,
            createdAt: Date.now(),
            read: false,
            confidence: p.confidence,
          });
        }
        continue;
      }

      const condId = RULE_TO_CONDITION[rule.kind];
      const cond = res.conditions.find((c) => c.id === condId);
      if (cond?.met) {
        seen.add(dedupeKey);
        events.push({
          id: uid(),
          ruleKind: rule.kind,
          symbol: sym,
          title: `${sym}: ${RULE_META[rule.kind].label}`,
          body: cond.detail,
          explanation: `${RULE_META[rule.kind].help} What we saw: ${cond.detail} This is a possible bullish signal, not a guarantee — always check the chart and the company before acting.`,
          createdAt: Date.now(),
          read: false,
          confidence: null,
        });
      }
    }
  }
  return events;
}

/**
 * First-run spotlight: when a user has no alert history yet and none of their
 * rules fire, surface the strongest genuine pattern detections across the
 * whole universe so the alert feed demonstrates itself. Clearly labeled as
 * scanner spotlights, not watchlist alerts.
 */
export async function scannerSpotlight(minConfidence: number, seen: Set<string>): Promise<AlertEvent[]> {
  const { results } = await scanUniverse();
  const today = new Date().toDateString();
  const events: AlertEvent[] = [];
  const hits = results
    .filter((r) => r.patterns.length > 0 && r.patterns[0].confidence >= minConfidence)
    .sort((a, b) => b.patterns[0].confidence - a.patterns[0].confidence)
    .slice(0, 3);
  for (const r of hits) {
    const p = r.patterns[0];
    const key = `spotlight:${r.symbol}:${today}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      id: uid(),
      ruleKind: "bullish-pattern",
      symbol: r.symbol,
      title: `Scanner spotlight — ${r.symbol}: possible ${p.label}`,
      body: `${p.label} detected across the scan universe with ${Math.round(p.confidence * 100)}% confidence. Not on your watchlist — surfaced by the market-wide scan.`,
      explanation: `${p.explanation} This came from the market-wide scanner, not your watchlist rules. Add ${r.symbol} to a watchlist if you want rule-based alerts for it. Pattern detection is probabilistic — treat this as a reason to look closer, not a guarantee.`,
      createdAt: Date.now(),
      read: false,
      confidence: p.confidence,
    });
  }
  return events;
}

/** Default starter rules for a new user: watchlist-wide coverage. */
export function defaultRules(): AlertRule[] {
  const kinds: AlertRuleKind[] = ["cross-above-200ma", "macd-bull-cross", "unusual-volume", "bullish-pattern"];
  return kinds.map((kind) => ({ id: uid(), kind, symbol: "ANY_WATCHLIST", enabled: true, createdAt: Date.now() }));
}
