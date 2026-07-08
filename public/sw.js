/*
 * Market Mentor service worker.
 * - App-shell caching for offline/installed PWA use.
 * - Web Push handler: production-ready. Today alerts are simulated client-side,
 *   but a backend can start sending real pushes to the existing subscription
 *   without changing this file.
 */
const CACHE = "market-mentor-v3";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for navigation, cache-first for hashed static assets.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (req.url.includes("/assets/") || req.url.includes("/icons/"))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

// Web-push entry point. The backend sends EMPTY pushes (no payload
// encryption needed); we wake up, fetch the queued notifications from the
// data relay, and show each one. Pushes WITH a payload also still work.
const RELAY = "https://market-mentor-data.daniel431994.workers.dev";

async function endpointHash(endpoint) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function show(reg, data) {
  return reg.showNotification(data.title || "Market Mentor", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/alerts" },
    tag: data.tag || undefined,
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    // Payload push: show it directly.
    if (event.data) {
      try { return await show(self.registration, event.data.json()); } catch (_) {}
    }
    // Empty push: fetch what's pending for this subscription.
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (!sub) return;
      const hash = await endpointHash(sub.endpoint);
      const res = await fetch(`${RELAY}/push/pending?e=${hash}`);
      const { items } = await res.json();
      if (!items || items.length === 0) {
        return show(self.registration, { title: "Market Mentor", body: "New market activity on your watchlist.", url: "/alerts" });
      }
      for (const item of items) await show(self.registration, item);
    } catch (_) {
      // Even on failure, show something — a silent push can get the
      // subscription throttled by the browser.
      return show(self.registration, { title: "Market Mentor", body: "New market activity on your watchlist.", url: "/alerts" });
    }
  })());
});

// Simulated push: the app posts a message and we show a real OS notification,
// so the notification UX is identical to what a backend push would produce.
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "SIMULATED_PUSH") {
    self.registration.showNotification(msg.title || "Market Mentor", {
      body: msg.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: msg.url || "/alerts" },
      tag: msg.tag || undefined,
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) { client.navigate(url); return client.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
