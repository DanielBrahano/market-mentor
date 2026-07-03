/*
 * Market Mentor service worker.
 * - App-shell caching for offline/installed PWA use.
 * - Web Push handler: production-ready. Today alerts are simulated client-side,
 *   but a backend can start sending real pushes to the existing subscription
 *   without changing this file.
 */
const CACHE = "market-mentor-v1";
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

// Real web-push entry point (used when a backend starts pushing).
self.addEventListener("push", (event) => {
  let data = { title: "Market Mentor", body: "New alert", url: "/alerts" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
      tag: data.tag || undefined,
    })
  );
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
