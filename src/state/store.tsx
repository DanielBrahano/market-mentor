import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AlertEvent, AlertRule, SavedScreen, UserSettings, Watchlist } from "../lib/types";
import { defaultRules, evaluateRules, scannerSpotlight } from "../lib/alerts/engine";
import { uid } from "../lib/utils";

/**
 * App store — no accounts. Everyone who opens the app can use it immediately;
 * watchlists, alert rules, history and settings live in this browser's
 * localStorage. The data shapes still mirror what a backend would store, so
 * adding synced accounts later is a mechanical change.
 */

const LS_DATA = "mm:data:local";

interface UserData {
  watchlists: Watchlist[];
  alertRules: AlertRule[];
  alertHistory: AlertEvent[];
  savedScreens: SavedScreen[];
  settings: UserSettings;
}

const defaultSettings = (): UserSettings => ({
  theme: "dark",
  beginnerMode: true,
  displayName: "Friend",
  notifications: { minConfidence: 0.6 },
});

const defaultUserData = (): UserData => ({
  watchlists: [{ id: uid(), name: "My Watchlist", symbols: ["NVDA", "AAPL", "HIMS", "RKLB"], createdAt: Date.now() }],
  alertRules: defaultRules(),
  alertHistory: [],
  savedScreens: [],
  settings: defaultSettings(),
});

function loadData(): UserData {
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (!raw) return defaultUserData();
    const parsed = JSON.parse(raw);
    const base = defaultUserData();
    return {
      watchlists: Array.isArray(parsed.watchlists) ? parsed.watchlists : base.watchlists,
      alertRules: Array.isArray(parsed.alertRules) ? parsed.alertRules : base.alertRules,
      alertHistory: Array.isArray(parsed.alertHistory) ? parsed.alertHistory : [],
      savedScreens: Array.isArray(parsed.savedScreens) ? parsed.savedScreens : [],
      settings: { ...base.settings, ...(parsed.settings ?? {}), notifications: { ...base.settings.notifications, ...(parsed.settings?.notifications ?? {}) } },
    };
  } catch {
    return defaultUserData();
  }
}

interface StoreApi {
  watchlists: Watchlist[];
  createWatchlist: (name: string) => void;
  deleteWatchlist: (id: string) => void;
  toggleSymbol: (watchlistId: string, symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  watchedSymbols: string[];

  alertRules: AlertRule[];
  addRule: (rule: Omit<AlertRule, "id" | "createdAt">) => void;
  toggleRule: (id: string) => void;
  removeRule: (id: string) => void;
  alerts: AlertEvent[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAlerts: () => void;

  savedScreens: SavedScreen[];
  saveScreen: (name: string, filters: Record<string, unknown>) => void;
  deleteScreen: (id: string) => void;

  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  updateNotifications: (patch: Partial<UserSettings["notifications"]>) => void;

  simulateAlertNow: () => Promise<number>;
}

const StoreCtx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<UserData>(loadData);

  // Dedupe key per (rule, symbol, day). Seeded from persisted history so the
  // same alert doesn't re-fire every time the app reloads.
  const seenRef = useRef<Set<string> | null>(null);
  if (seenRef.current === null) {
    seenRef.current = new Set(
      data.alertHistory.map((a) => `${a.ruleKind}:${a.symbol}:${new Date(a.createdAt).toDateString()}`)
    );
  }

  useEffect(() => {
    localStorage.setItem(LS_DATA, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  const watchedSymbols = useMemo(
    () => Array.from(new Set(data.watchlists.flatMap((w) => w.symbols))),
    [data.watchlists]
  );

  /** Evaluate alert rules against the latest scan; record new events in-app. */
  const runAlertCycle = useCallback(async (): Promise<number> => {
    const seen = seenRef.current!;
    let events = await evaluateRules(
      data.alertRules,
      watchedSymbols,
      data.settings.notifications.minConfidence,
      seen
    );
    // First run with an empty feed: show genuine market-wide detections so
    // the user sees what alerts look like (clearly labeled as spotlights).
    if (events.length === 0 && data.alertHistory.length === 0) {
      events = await scannerSpotlight(data.settings.notifications.minConfidence, seen);
    }
    if (events.length === 0) return 0;
    setData((d) => ({ ...d, alertHistory: [...events, ...d.alertHistory].slice(0, 200) }));
    return events.length;
  }, [data.alertRules, data.settings.notifications.minConfidence, data.alertHistory.length, watchedSymbols]);

  // Background alert evaluation: shortly after load, then every 3 minutes.
  // (The first cycle also warms the full-market scan.)
  useEffect(() => {
    const t0 = window.setTimeout(() => void runAlertCycle(), 2000);
    const t = window.setInterval(() => void runAlertCycle(), 180_000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, [runAlertCycle]);

  const api: StoreApi = {
    watchlists: data.watchlists,
    createWatchlist: (name) =>
      setData((d) => ({ ...d, watchlists: [...d.watchlists, { id: uid(), name, symbols: [], createdAt: Date.now() }] })),
    deleteWatchlist: (id) => setData((d) => ({ ...d, watchlists: d.watchlists.filter((w) => w.id !== id) })),
    toggleSymbol: (watchlistId, symbol) =>
      setData((d) => ({
        ...d,
        watchlists: d.watchlists.map((w) =>
          w.id !== watchlistId ? w : {
            ...w,
            symbols: w.symbols.includes(symbol) ? w.symbols.filter((s) => s !== symbol) : [...w.symbols, symbol],
          }
        ),
      })),
    isWatched: (symbol) => watchedSymbols.includes(symbol),
    watchedSymbols,

    alertRules: data.alertRules,
    addRule: (rule) => setData((d) => ({ ...d, alertRules: [...d.alertRules, { ...rule, id: uid(), createdAt: Date.now() }] })),
    toggleRule: (id) =>
      setData((d) => ({ ...d, alertRules: d.alertRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) })),
    removeRule: (id) => setData((d) => ({ ...d, alertRules: d.alertRules.filter((r) => r.id !== id) })),
    alerts: data.alertHistory,
    unreadCount: data.alertHistory.filter((a) => !a.read).length,
    markAllRead: () => setData((d) => ({ ...d, alertHistory: d.alertHistory.map((a) => ({ ...a, read: true })) })),
    markRead: (id) => setData((d) => ({ ...d, alertHistory: d.alertHistory.map((a) => (a.id === id ? { ...a, read: true } : a)) })),
    clearAlerts: () => setData((d) => ({ ...d, alertHistory: [] })),

    savedScreens: data.savedScreens,
    saveScreen: (name, filters) =>
      setData((d) => ({ ...d, savedScreens: [...d.savedScreens, { id: uid(), name, filters, createdAt: Date.now() }] })),
    deleteScreen: (id) => setData((d) => ({ ...d, savedScreens: d.savedScreens.filter((s) => s.id !== id) })),

    settings: data.settings,
    updateSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    updateNotifications: (patch) =>
      setData((d) => ({ ...d, settings: { ...d.settings, notifications: { ...d.settings.notifications, ...patch } } })),

    simulateAlertNow: runAlertCycle,
  };

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}
