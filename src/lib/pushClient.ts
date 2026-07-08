import { WORKER_BASE } from "./data/liveProvider";

/**
 * Web Push client: subscribe this browser to server-side alerts.
 * The data relay's cron sweeps watchlist symbols every 15 minutes during
 * market hours and pushes even when the app is closed.
 */

export type PushStatus = "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  const reg = await registration();
  if (!reg) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Ask permission, subscribe, and register the watchlist with the relay. */
export async function enablePush(symbols: string[]): Promise<{ ok: boolean; reason?: string }> {
  const reg = await registration();
  if (!reg) return { ok: false, reason: "This browser doesn't support push notifications. On iPhone, install the app to your Home Screen first (Share → Add to Home Screen)." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notification permission was not granted. You can change this in your browser's site settings." };

  const { publicKey } = await (await fetch(`${WORKER_BASE}/push/vapid`)).json();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  const res = await fetch(`${WORKER_BASE}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), symbols }),
  });
  if (!res.ok) return { ok: false, reason: "The alert relay rejected the subscription. Try again in a minute." };
  return { ok: true };
}

/** Keep the relay's symbol list in sync with the current watchlists. */
export async function syncPush(symbols: string[]): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch(`${WORKER_BASE}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), symbols }),
  }).catch(() => {});
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch(`${WORKER_BASE}/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

/** Ask the relay to send a real test notification to this device. */
export async function sendTestPush(): Promise<boolean> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  const res = await fetch(`${WORKER_BASE}/push/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  return res.ok && (await res.json()).ok === true;
}
