import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AlertEvent, AlertRule, SavedScreen, UserProfile, UserSettings, Watchlist } from "../lib/types";
import { defaultRules, evaluateRules, scannerSpotlight } from "../lib/alerts/engine";
import { uid } from "../lib/utils";

/**
 * App store: local multi-user accounts + per-user data, persisted to
 * localStorage. The shape mirrors what a real backend would store per user,
 * so swapping localStorage for API calls is a mechanical change.
 */

const LS_USERS = "mm:users";
const LS_SESSION = "mm:session";
const LS_INVITES = "mm:invites";
const userKey = (userId: string) => `mm:data:${userId}`;

/** Invite codes that can create accounts. New users get codes to share. */
const DEFAULT_INVITES = ["MENTOR-FRIENDS", "BULLS-2026"];

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
  notifications: { inApp: true, push: false, watchlistOnly: true, minConfidence: 0.6, quietHours: false },
});

const defaultUserData = (): UserData => ({
  watchlists: [{ id: uid(), name: "My Watchlist", symbols: ["NVDA", "AAPL", "HIMS", "RKLB"], createdAt: Date.now() }],
  alertRules: defaultRules(),
  alertHistory: [],
  savedScreens: [],
  settings: defaultSettings(),
});

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

interface StoreApi {
  user: UserProfile | null;
  users: UserProfile[];
  login: (username: string) => boolean;
  register: (username: string, displayName: string, inviteCode: string) => string | null;
  logout: () => void;
  myInviteCode: string;

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

  pushPermission: NotificationPermission | "unsupported";
  requestPush: () => Promise<void>;
  simulateAlertNow: () => Promise<number>;
}

const StoreCtx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<UserProfile[]>(() => load(LS_USERS, [] as UserProfile[]));
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(LS_SESSION));
  const user = users.find((u) => u.id === sessionId) ?? null;

  const [data, setData] = useState<UserData>(() =>
    sessionId ? load(userKey(sessionId), defaultUserData()) : defaultUserData()
  );
  const seenRef = useRef<Set<string>>(new Set());

  // Persist per-user data on change.
  useEffect(() => {
    if (user) save(userKey(user.id), data);
  }, [data, user?.id]);

  // Theme attribute on <html>.
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  const login = useCallback((username: string): boolean => {
    const u = users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u) return false;
    setSessionId(u.id);
    localStorage.setItem(LS_SESSION, u.id);
    setData(load(userKey(u.id), defaultUserData()));
    seenRef.current = new Set();
    return true;
  }, [users]);

  const register = useCallback((username: string, displayName: string, inviteCode: string): string | null => {
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return "Username must be 3–20 letters, numbers or underscores.";
    if (users.some((x) => x.username === uname)) return "That username is taken.";
    const invites = load(LS_INVITES, DEFAULT_INVITES);
    const code = inviteCode.trim().toUpperCase();
    if (!invites.includes(code)) return "Invalid invite code. Ask a friend who already uses Market Mentor.";
    const profile: UserProfile = { id: uid(), username: uname, displayName: displayName.trim() || uname, createdAt: Date.now(), invitedBy: code };
    const next = [...users, profile];
    setUsers(next);
    save(LS_USERS, next);
    // Each user gets a personal invite code to share.
    const personal = `${uname.toUpperCase().slice(0, 8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    save(LS_INVITES, [...invites, personal]);
    localStorage.setItem(`mm:invite:${profile.id}`, personal);
    setSessionId(profile.id);
    localStorage.setItem(LS_SESSION, profile.id);
    setData(defaultUserData());
    seenRef.current = new Set();
    return null;
  }, [users]);

  const logout = useCallback(() => {
    setSessionId(null);
    localStorage.removeItem(LS_SESSION);
  }, []);

  const myInviteCode = user ? localStorage.getItem(`mm:invite:${user.id}`) ?? DEFAULT_INVITES[0] : "";

  const watchedSymbols = useMemo(
    () => Array.from(new Set(data.watchlists.flatMap((w) => w.symbols))),
    [data.watchlists]
  );

  const requestPush = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
    if (perm === "granted") {
      setData((d) => ({ ...d, settings: { ...d.settings, notifications: { ...d.settings.notifications, push: true } } }));
      // Architecture note: with a backend, we would now call
      // registration.pushManager.subscribe({ userVisibleOnly: true,
      // applicationServerKey: <VAPID public key> }) and POST the subscription
      // to the server. The service worker's `push` handler is already wired.
    }
  }, []);

  const deliverViaServiceWorker = useCallback(async (ev: AlertEvent) => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      reg?.active?.postMessage({
        type: "SIMULATED_PUSH",
        title: ev.title,
        body: ev.body,
        url: `/stock/${ev.symbol}`,
        tag: ev.id,
      });
    } catch { /* notification delivery is best-effort */ }
  }, []);

  /** Evaluate alert rules and record/deliver any new events. */
  const runAlertCycle = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    let events = await evaluateRules(
      data.alertRules,
      watchedSymbols,
      data.settings.notifications.minConfidence,
      seenRef.current
    );
    // First run with an empty feed: show genuine market-wide detections so
    // the user sees what alerts look like (clearly labeled as spotlights).
    if (events.length === 0 && data.alertHistory.length === 0) {
      events = await scannerSpotlight(data.settings.notifications.minConfidence, seenRef.current);
    }
    if (events.length === 0) return 0;
    setData((d) => ({ ...d, alertHistory: [...events, ...d.alertHistory].slice(0, 200) }));
    if (data.settings.notifications.push && pushPermission === "granted" && !data.settings.notifications.quietHours) {
      for (const ev of events.slice(0, 3)) void deliverViaServiceWorker(ev);
    }
    return events.length;
  }, [user, data.alertRules, data.settings.notifications, watchedSymbols, pushPermission, deliverViaServiceWorker]);

  // Background alert evaluation: on login and every 90s (simulates the
  // server-side scanning job an installed PWA would receive pushes from).
  useEffect(() => {
    if (!user) return;
    const t0 = window.setTimeout(() => void runAlertCycle(), 2500);
    const t = window.setInterval(() => void runAlertCycle(), 90_000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, [user?.id, runAlertCycle]);

  const api: StoreApi = {
    user,
    users,
    login,
    register,
    logout,
    myInviteCode,

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

    pushPermission,
    requestPush,
    simulateAlertNow: runAlertCycle,
  };

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}
