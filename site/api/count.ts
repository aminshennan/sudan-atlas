// POST /api/count  {page, event, format}  adds 1 to that count (204, or 202 when no store is set up).
// GET  /api/count  returns the all-time counts and this month's, as JSON. Counts are public: they
// say how much each feature is used and nothing about anyone.
// Each address may make 30 requests a minute (see _limit.ts); more get 429.
import { allowedOrigin, fieldFor, monthKey, pipeline, storeFrom, toCounts, TOTALS_KEY } from "./_counter.js";
import { rateLimit, tooMany } from "./_limit.js";

const COUNT_LIMIT = 30;

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60" } });

export default {
  async fetch(request: Request): Promise<Response> {
    const store = storeFrom(env);
    if (request.method === "GET") {
      if (!store) return json({ configured: false });
      const limited = await rateLimit(request, "count", COUNT_LIMIT, store);
      if (!limited.ok) return tooMany(limited.retryAfter);
      const now = new Date();
      const [totals, month] = await pipeline(store, [["HGETALL", TOTALS_KEY], ["HGETALL", monthKey(now)]]);
      return json({ configured: true, totals: toCounts(totals), month: { [now.toISOString().slice(0, 7)]: toCounts(month) } });
    }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
    if (!allowedOrigin(request.headers.get("origin"))) return new Response(null, { status: 403 });
    const text = await request.text();
    if (text.length > 200) return new Response(null, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
    const field = fieldFor(body);
    if (!field) return new Response(null, { status: 400 });
    if (!store) return new Response(null, { status: 202 }); // not set up yet: accept and forget
    const limited = await rateLimit(request, "count", COUNT_LIMIT, store);
    if (!limited.ok) return tooMany(limited.retryAfter);
    try {
      const month = monthKey(new Date());
      await pipeline(store, [["HINCRBY", TOTALS_KEY, field, 1], ["HINCRBY", month, field, 1], ["EXPIRE", month, 60 * 60 * 24 * 800]]);
    } catch {
      return new Response(null, { status: 503 });
    }
    return new Response(null, { status: 204 });
  },
};
