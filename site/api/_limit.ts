// Rate limiting for the API: at most `limit` requests a minute from one address. The address is
// never stored: the key is a SHA-256 hash of it, mixed with the store's secret token so the hash
// cannot be reversed by trying every address, and the key expires after the minute.
// A warm function also remembers recent counts in memory, so a flood is turned away without
// spending a Redis command on each request. If the store cannot be reached, requests are let
// through: the limiter must never take the site down.
import { pipeline, type Store } from "./_counter.js";

const WINDOW_S = 60;
const local = new Map<string, number>();

/** The caller's address as Vercel reports it, or "unknown". */
export function clientAddress(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface LimitResult { ok: boolean; retryAfter: number }

/** Count this request against the caller's limit for `scope` ("count" or "mcp"). */
export async function rateLimit(request: Request, scope: string, limit: number, store: Store | null, now = Date.now()): Promise<LimitResult> {
  const window = Math.floor(now / 1000 / WINDOW_S);
  const retryAfter = WINDOW_S - (Math.floor(now / 1000) % WINDOW_S);
  const id = await sha256(`${store?.token ?? "no-store"}|${scope}|${clientAddress(request)}`);
  const key = `sa:rl:${scope}:${id}:${window}`;

  // Forget windows that have passed, so the map stays small.
  if (local.size > 5000) local.clear();
  for (const k of local.keys()) if (!k.endsWith(`:${window}`)) local.delete(k);
  const seen = (local.get(key) ?? 0) + 1;
  local.set(key, seen);
  if (seen > limit) return { ok: false, retryAfter };
  if (!store) return { ok: true, retryAfter };

  try {
    const [count] = await pipeline(store, [["INCR", key], ["EXPIRE", key, WINDOW_S + 5]]);
    const n = Number(count);
    if (n > seen) local.set(key, n); // other instances have seen this caller too
    return { ok: n <= limit, retryAfter };
  } catch {
    return { ok: true, retryAfter };
  }
}

export function tooMany(retryAfter: number, headers: Record<string, string> = {}, body: string | null = null): Response {
  return new Response(body, { status: 429, headers: { "Retry-After": String(retryAfter), ...headers } });
}
