import { useEffect, useState } from "react";
import type { Quote } from "./types";
import { provider } from "./data/provider";

/**
 * Live quotes for the symbols currently on screen.
 *
 * Scan snapshots are cached for up to 10 minutes, so table prices would lag
 * live trading. This hook re-quotes just the visible symbols (batched through
 * the provider) on mount and every `intervalMs`, letting tables show current
 * prices, change % and extended-hours prints without re-running the scan.
 */
export function useFreshQuotes(symbols: string[], intervalMs = 45_000): Map<string, Quote> {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(() => new Map());
  const key = symbols.join(",");

  useEffect(() => {
    if (symbols.length === 0) { setQuotes(new Map()); return; }
    let dead = false;
    const tick = async () => {
      try {
        const qs = await provider().getQuotes(symbols);
        if (!dead) setQuotes(new Map(qs.map((q) => [q.symbol, q])));
      } catch { /* transient failure: keep showing the last good quotes */ }
    };
    void tick();
    const t = window.setInterval(tick, intervalMs);
    return () => { dead = true; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);

  return quotes;
}
