/**
 * Server-side alert scanning + Web Push for Market Mentor.
 *
 * Every 15 minutes (cron) the worker:
 *  1. Bails out cheaply if the market has been closed for over an hour.
 *  2. Collects all push subscriptions from KV and unions their symbols
 *     (capped to respect the free plan's 50-subrequests-per-run limit).
 *  3. Fetches daily candles per symbol and evaluates transparent rules
 *     (200/50-day MA cross, MACD cross, volume spike, RSI recovery,
 *     60-day breakout) — the same spirit as the in-app scanner.
 *  4. Queues plain-English notifications per subscriber in KV and sends an
 *     EMPTY web push (VAPID-authenticated). Empty pushes need no payload
 *     encryption; the service worker wakes, fetches /push/pending and shows
 *     the queued notifications. Dedupe is per (rule, symbol, day).
 */

const MAX_SYMBOLS_PER_RUN = 30;
const MAX_PUSHES_PER_RUN = 14;
const VAPID_SUB = "mailto:daniel431994@googlemail.com";

// ---------------------------------------------------------------- helpers

const enc = new TextEncoder();

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** VAPID Authorization header (ES256 JWT) for a push endpoint origin. */
async function vapidAuth(endpoint, env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB,
  })));
  const signing = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signing)
  );
  return `vapid t=${signing}.${b64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/** Send an empty (payload-less) web push. Returns HTTP status. */
async function sendPush(subscription, env) {
  try {
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: { Authorization: await vapidAuth(subscription.endpoint, env), TTL: "3600", Urgency: "normal" },
    });
    return res.status;
  } catch {
    return 0;
  }
}

// ------------------------------------------------------ indicator helpers

function smaAt(vals, n, i) {
  if (i + 1 < n) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += vals[k];
  return s / n;
}

function emaSeries(vals, n) {
  const k = 2 / (n + 1);
  const out = new Array(vals.length).fill(NaN);
  let prev = vals[0];
  out[0] = prev;
  for (let i = 1; i < vals.length; i++) { prev = vals[i] * k + prev * (1 - k); out[i] = prev; }
  return out;
}

function rsiAt(closes, period, i) {
  if (i < period) return NaN;
  let g = 0, l = 0;
  for (let k = i - period + 1; k <= i; k++) {
    const d = closes[k] - closes[k - 1];
    if (d > 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / l);
}

/** Evaluate alert rules on daily candles; returns [{kind,title,body}] */
export function evaluateServerRules(symbol, candles) {
  const out = [];
  const n = candles.length;
  if (n < 210) return out;
  const closes = candles.map((c) => c.c);
  const vols = candles.map((c) => c.v);
  const i = n - 1, prev = n - 2;
  const px = closes[i].toFixed(2);

  const sma200Now = smaAt(closes, 200, i), sma200Prev = smaAt(closes, 200, prev);
  if (closes[prev] <= sma200Prev && closes[i] > sma200Now) {
    out.push({ kind: "cross-200ma", title: `${symbol}: crossed above 200-day average`, body: `Price ($${px}) reclaimed its 200-day moving average — a widely watched long-term trend signal.` });
  }
  const sma50Now = smaAt(closes, 50, i), sma50Prev = smaAt(closes, 50, prev);
  if (closes[prev] <= sma50Prev && closes[i] > sma50Now) {
    out.push({ kind: "cross-50ma", title: `${symbol}: crossed above 50-day average`, body: `Price ($${px}) moved back above its 50-day moving average — medium-term trend turning up.` });
  }

  const ema12 = emaSeries(closes, 12), ema26 = emaSeries(closes, 26);
  const macd = closes.map((_, k) => ema12[k] - ema26[k]);
  const signal = emaSeries(macd, 9);
  if (macd[prev] <= signal[prev] && macd[i] > signal[i]) {
    out.push({ kind: "macd-cross", title: `${symbol}: MACD bullish crossover`, body: `MACD line crossed above its signal line — short-term momentum turning up vs longer-term.` });
  }

  let avg20 = 0;
  for (let k = i - 20; k < i; k++) avg20 += vols[k];
  avg20 /= 20;
  if (avg20 > 0 && vols[i] > 1.8 * avg20) {
    out.push({ kind: "volume-spike", title: `${symbol}: unusual volume (${(vols[i] / avg20).toFixed(1)}×)`, body: `Trading volume is ${(vols[i] / avg20).toFixed(1)}× the 20-day average — unusual attention, check the news.` });
  }

  const rsiNow = rsiAt(closes, 14, i), rsiPrev = rsiAt(closes, 14, prev);
  if (rsiPrev < 30 && rsiNow >= 30) {
    out.push({ kind: "rsi-recovery", title: `${symbol}: RSI recovering from oversold`, body: `RSI climbed back above 30 (now ${rsiNow.toFixed(0)}) — selling pressure may be easing.` });
  }

  let hi60 = -Infinity;
  for (let k = i - 60; k < i; k++) if (candles[k].h > hi60) hi60 = candles[k].h;
  if (closes[i] > hi60 * 1.002) {
    out.push({ kind: "breakout-60d", title: `${symbol}: 60-day breakout`, body: `Closed at $${px}, above the prior 60-day high of $${hi60.toFixed(2)} — buyers overwhelmed a known resistance level.` });
  }
  return out;
}

// ------------------------------------------------------------- cron logic

/** One evaluation pass. Returns a summary object (also used by /push/run). */
export async function runAlertSweep(env, fetchChart, force = false) {
  const summary = { marketState: null, subs: 0, symbols: 0, triggered: 0, queued: 0, pushed: 0, skipped: false };

  // Market-state gate (1 subrequest): skip when closed for > 90 minutes.
  const spy = await fetchChart("SPY", { range: "1d", interval: "5m", includePrePost: "true" });
  const period = spy.meta.currentTradingPeriod;
  const nowSec = Math.floor(Date.now() / 1000);
  const inSession = period && nowSec >= period.pre.start && nowSec < period.post.end;
  const justClosed = period && nowSec >= period.post.end && nowSec - period.regular.end < 5400;
  summary.marketState = inSession ? "SESSION" : justClosed ? "JUST_CLOSED" : "CLOSED";
  if (!inSession && !justClosed && !force) { summary.skipped = true; return summary; }

  // Load subscriptions.
  const list = await env.MM_KV.list({ prefix: "sub:" });
  const subs = [];
  for (const k of list.keys.slice(0, 50)) {
    const v = await env.MM_KV.get(k.name, "json");
    if (v?.subscription?.endpoint) subs.push({ key: k.name, ...v });
  }
  summary.subs = subs.length;
  if (subs.length === 0) { summary.skipped = true; return summary; }

  // Union of watched symbols, capped for the subrequest budget.
  const symbols = [...new Set(subs.flatMap((s) => s.symbols || []))].slice(0, MAX_SYMBOLS_PER_RUN);
  summary.symbols = symbols.length;
  if (symbols.length === 0) { summary.skipped = true; return summary; }

  // Per-day dedupe set.
  const day = new Date().toISOString().slice(0, 10);
  const sentKey = `sent:${day}`;
  const sent = new Set((await env.MM_KV.get(sentKey, "json")) || []);

  // Evaluate each symbol.
  const hits = [];
  for (const sym of symbols) {
    try {
      const chart = await fetchChart(sym.replace(/\./g, "-"), { range: "1y", interval: "1d" });
      const ts = chart.timestamp || [];
      const q = chart.indicators?.quote?.[0] || {};
      const candles = [];
      for (let k = 0; k < ts.length; k++) {
        if (q.close?.[k] == null) continue;
        candles.push({ c: q.close[k], h: q.high[k], v: q.volume?.[k] ?? 0 });
      }
      for (const hit of evaluateServerRules(sym, candles)) {
        const dedupe = `${hit.kind}:${sym}`;
        if (!sent.has(dedupe)) { sent.add(dedupe); hits.push({ ...hit, symbol: sym }); }
      }
    } catch { /* symbol fetch failed — skip */ }
  }
  summary.triggered = hits.length;

  if (hits.length > 0) {
    await env.MM_KV.put(sentKey, JSON.stringify([...sent]), { expirationTtl: 172800 });

    // Queue per-subscriber notifications and send empty wake-up pushes.
    let pushBudget = MAX_PUSHES_PER_RUN;
    for (const sub of subs) {
      const mine = hits.filter((h) => (sub.symbols || []).includes(h.symbol));
      if (mine.length === 0) continue;
      const hash = await sha256hex(sub.subscription.endpoint);
      const pendingKey = `pending:${hash}`;
      const existing = (await env.MM_KV.get(pendingKey, "json")) || [];
      const queued = [...existing, ...mine.map((h) => ({
        title: h.title, body: h.body, url: `/stock/${h.symbol}`, tag: `${h.kind}:${h.symbol}:${day}`,
      }))].slice(-10);
      await env.MM_KV.put(pendingKey, JSON.stringify(queued), { expirationTtl: 86400 });
      summary.queued += mine.length;

      if (pushBudget-- > 0) {
        const status = await sendPush(sub.subscription, env);
        if (status >= 200 && status < 300) summary.pushed++;
        else if (status === 404 || status === 410) await env.MM_KV.delete(sub.key); // expired sub
      }
    }
  }
  return summary;
}

// ------------------------------------------------------------ HTTP routes

/** Handle /push/* routes. Returns a Response or null if not a push route. */
export async function handlePushRoute(url, request, env, json, err) {
  switch (url.pathname) {
    case "/push/vapid":
      return json({ publicKey: env.VAPID_PUBLIC_KEY }, 3600);

    case "/push/subscribe": {
      if (request.method !== "POST") return err("POST required", 405);
      const body = await request.json().catch(() => null);
      const endpoint = body?.subscription?.endpoint;
      if (!endpoint || !endpoint.startsWith("https://")) return err("invalid subscription");
      const symbols = (Array.isArray(body.symbols) ? body.symbols : [])
        .map((s) => String(s).toUpperCase()).filter((s) => /^[A-Z.]{1,6}$/.test(s)).slice(0, 60);
      const hash = await sha256hex(endpoint);
      await env.MM_KV.put(`sub:${hash}`, JSON.stringify({
        subscription: body.subscription, symbols, updatedAt: Date.now(),
      }));
      return json({ ok: true, symbols: symbols.length }, 0);
    }

    case "/push/unsubscribe": {
      if (request.method !== "POST") return err("POST required", 405);
      const body = await request.json().catch(() => null);
      if (!body?.endpoint) return err("endpoint required");
      const hash = await sha256hex(body.endpoint);
      await env.MM_KV.delete(`sub:${hash}`);
      await env.MM_KV.delete(`pending:${hash}`);
      return json({ ok: true }, 0);
    }

    case "/push/test": {
      // User-scoped: queues a test notification for the caller's own
      // subscription and sends a wake-up push, so people can verify setup.
      if (request.method !== "POST") return err("POST required", 405);
      const body = await request.json().catch(() => null);
      if (!body?.endpoint) return err("endpoint required");
      const hash = await sha256hex(body.endpoint);
      const sub = await env.MM_KV.get(`sub:${hash}`, "json");
      if (!sub?.subscription) return err("not subscribed", 404);
      const pendingKey = `pending:${hash}`;
      const existing = (await env.MM_KV.get(pendingKey, "json")) || [];
      await env.MM_KV.put(pendingKey, JSON.stringify([...existing, {
        title: "Market Mentor: push is working 🎉",
        body: `You'll get alerts here when your watchlist stocks trigger rules — checked every 15 minutes during market hours, even with the app closed. Watching ${(sub.symbols || []).length} stocks.`,
        url: "/alerts",
        tag: "test",
      }].slice(-10)), { expirationTtl: 86400 });
      const status = await sendPush(sub.subscription, env);
      return json({ ok: status >= 200 && status < 300, pushStatus: status }, 0);
    }

    case "/push/pending": {
      const e = url.searchParams.get("e") || "";
      if (!/^[0-9a-f]{64}$/.test(e)) return err("invalid id");
      const key = `pending:${e}`;
      const items = (await env.MM_KV.get(key, "json")) || [];
      if (items.length > 0) await env.MM_KV.delete(key); // read-and-clear
      return json({ items }, 0);
    }

    default:
      return null;
  }
}
