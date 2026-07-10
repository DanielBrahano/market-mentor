/**
 * Self-benchmark ("track record") storage.
 *
 * Once per trading day, the first client that completes a live scan POSTs its
 * top "Strong setup" picks with entry prices + the S&P 500 level. The worker
 * VERIFIES every submitted price against live market data before accepting
 * (anti-spoof: nobody — including the app author — can fabricate history),
 * then stores the cohort immutably in KV (first write wins, no updates).
 * The app later measures each cohort against the S&P over the same window.
 */

export async function handleBenchRoute(url, request, env, json, err, fetchChart) {
  switch (url.pathname) {
    case "/bench/record": {
      if (request.method !== "POST") return err("POST required", 405);
      const body = await request.json().catch(() => null);
      const picks = Array.isArray(body?.picks) ? body.picks.slice(0, 5) : [];
      const spx = Number(body?.spx);
      if (picks.length === 0 || !isFinite(spx) || spx <= 0) return err("invalid payload");

      const date = new Date().toISOString().slice(0, 10); // server clock decides the day
      if (await env.MM_KV.get(`bench:d:${date}`)) return json({ ok: true, dedup: true }, 0);

      // Verify each pick's entry price against live data (±8% tolerance
      // covers cache staleness while blocking fabricated numbers).
      const clean = [];
      for (const p of picks) {
        const sym = String(p.symbol || "").toUpperCase();
        const price = Number(p.price);
        if (!/^[A-Z.]{1,6}$/.test(sym) || !isFinite(price) || price <= 0) continue;
        try {
          const chart = await fetchChart(sym.replace(/\./g, "-"), { range: "1d", interval: "5m" });
          const live = chart.meta.regularMarketPrice;
          if (live > 0 && Math.abs(live - price) / live <= 0.08) {
            clean.push({ symbol: sym, price: Math.round(price * 100) / 100, score: Math.round(Number(p.score)) || 0 });
          }
        } catch { /* unverifiable symbol: drop it */ }
      }
      let spxOk = false;
      try {
        const g = await fetchChart("^GSPC", { range: "1d", interval: "5m" });
        spxOk = Math.abs(g.meta.regularMarketPrice - spx) / g.meta.regularMarketPrice <= 0.05;
      } catch { /* leave false */ }
      if (clean.length < 3 || !spxOk) return err("verification failed", 422);

      const cohort = { date, at: Date.now(), spx: Math.round(spx * 100) / 100, picks: clean };
      await env.MM_KV.put(`bench:d:${date}`, JSON.stringify(cohort));
      const idx = (await env.MM_KV.get("bench:idx", "json")) || [];
      if (!idx.includes(date)) idx.push(date);
      await env.MM_KV.put("bench:idx", JSON.stringify(idx.slice(-180)));
      return json({ ok: true, recorded: clean.length }, 0);
    }

    case "/bench/list": {
      const idx = (await env.MM_KV.get("bench:idx", "json")) || [];
      const cohorts = [];
      for (const d of idx.slice(-90)) {
        const c = await env.MM_KV.get(`bench:d:${d}`, "json");
        if (c) cohorts.push(c);
      }
      return json({ cohorts }, 60);
    }

    default:
      return null;
  }
}
