/**
 * Data-source selection. The preference persists in localStorage and is
 * applied during bootstrap (main.tsx) before the app renders. "live" uses the
 * Cloudflare Worker proxy for real quotes (incl. pre/post market); "sim" uses
 * the deterministic simulated feed covering the full 2,400-stock universe.
 */

export type DataSourceId = "live" | "sim";

const KEY = "mm:dataSource";

/** Live mode is the default — the bootstrap falls back to sim if unreachable. */
export function getDataSourcePreference(): DataSourceId {
  const v = localStorage.getItem(KEY);
  return v === "sim" ? "sim" : "live";
}

export function setDataSourcePreference(id: DataSourceId): void {
  localStorage.setItem(KEY, id);
  // Provider wiring happens at bootstrap; a reload applies it cleanly.
  window.location.reload();
}

/** Set during bootstrap when live mode was requested but unreachable. */
let fellBack = false;
export function markLiveFallback() { fellBack = true; }
export function liveFellBack(): boolean { return fellBack; }
