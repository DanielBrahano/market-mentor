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

/**
 * Fixed evaluation horizons, in TRADING days. A cohort's verdict at each
 * horizon is computed from historical closing prices exactly N trading days
 * after entry, then frozen forever — unlike "since entry" tracking, a settled
 * verdict never changes, which is what makes the record accountable.
 */
const HORIZONS = [
	{ key: "1w", days: 5 },
	{ key: "1m", days: 21 },
	{ key: "3m", days: 63 },
];

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * Settle at most ONE cohort per invocation (subrequest budget: 5 picks + SPX
 * = 6 chart fetches). Runs from the cron; the backlog clears within hours.
 */
export async function settleBenchmarks(env, fetchChart) {
	const idx = (await env.MM_KV.get("bench:idx", "json")) || [];
	for (const date of idx) {
		const key = `bench:d:${date}`;
		const cohort = await env.MM_KV.get(key, "json");
		if (!cohort) continue;
		cohort.settled = cohort.settled || {};
		const pending = HORIZONS.filter((h) => !cohort.settled[h.key]);
		if (pending.length === 0) continue;
		// Calendar pre-check: 5 trading days need ≥7 calendar days.
		if (Date.now() - cohort.at < 6.5 * 86_400_000) continue;

		const closesOf = (chart) => {
			const ts = chart.timestamp || [];
			const cl = chart.indicators?.quote?.[0]?.close || [];
			const out = [];
			for (let i = 0; i < ts.length; i++) {
				if (cl[i] != null) out.push({ day: new Date(ts[i] * 1000).toISOString().slice(0, 10), c: cl[i] });
			}
			return out;
		};

		let spxSeries;
		try {
			spxSeries = closesOf(await fetchChart("^GSPC", { range: "1y", interval: "1d" }));
		} catch {
			return { settled: null, error: "spx fetch failed" };
		}
		// Entry anchor: first trading day on/after the cohort date. (A cohort
		// recorded on a weekend anchors to the next Monday; its entry prices
		// are the prior close, which slightly UNDERSTATES the picks' returns —
		// bias against ourselves is the acceptable direction.)
		const i0 = spxSeries.findIndex((x) => x.day >= cohort.date);
		if (i0 < 0) continue;

		const matured = pending.filter((h) => spxSeries.length > i0 + h.days);
		if (matured.length === 0) continue;

		const pickSeries = {};
		try {
			for (const p of cohort.picks) {
				pickSeries[p.symbol] = closesOf(await fetchChart(p.symbol.replace(/\./g, "-"), { range: "1y", interval: "1d" }));
			}
		} catch {
			return { settled: null, error: `pick fetch failed for ${date}` };
		}

		let changed = false;
		for (const h of matured) {
			const spxEnd = spxSeries[i0 + h.days].c;
			const spxRet = (spxEnd - cohort.spx) / cohort.spx;
			const picks = [];
			let sum = 0, n = 0;
			for (const p of cohort.picks) {
				const s = pickSeries[p.symbol] || [];
				const j0 = s.findIndex((x) => x.day >= cohort.date);
				if (j0 < 0 || s.length <= j0 + h.days) {
					picks.push({ symbol: p.symbol, ret: null });
					continue;
				}
				const ret = (s[j0 + h.days].c - p.price) / p.price;
				picks.push({ symbol: p.symbol, ret: round4(ret) });
				sum += ret;
				n++;
			}
			if (n === 0) continue;
			const avgRet = sum / n;
			cohort.settled[h.key] = {
				settledAt: Date.now(),
				avgRet: round4(avgRet),
				spxRet: round4(spxRet),
				alpha: round4(avgRet - spxRet),
				picks,
			};
			changed = true;
		}
		if (changed) {
			await env.MM_KV.put(key, JSON.stringify(cohort));
			return { settled: date, horizons: matured.map((h) => h.key) };
		}
	}
	return { settled: null };
}

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
