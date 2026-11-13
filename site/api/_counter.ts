// Usage counter: which features are used, never by whom. Each event adds 1 to a count named by
// page, event and format (for example "maker:map_export:png"), both for all time and for the
// month. No IP address, cookie, file name, place name or value is read or stored. Names are
// checked against fixed lists, so nothing else can be written.

export const PAGES = ["map", "maker", "home", "docs"] as const;
export const EVENTS = {
  match_run: ["csv", "tsv", "xlsx", "sample"],
  map_made: ["map"],
  map_export: ["svg", "png", "csv"],
  file_export: ["csv"],
} as const satisfies Record<string, readonly string[]>;
export type EventName = keyof typeof EVENTS;

export const TOTALS_KEY = "sa:counts";
export const monthKey = (d: Date) => `sa:counts:${d.toISOString().slice(0, 7)}`;

/** The field to increment for a request body, or null when the body is not one we count. */
export function fieldFor(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const { page, event, format } = body as Record<string, unknown>;
  if (typeof page !== "string" || !(PAGES as readonly string[]).includes(page)) return null;
  if (typeof event !== "string" || !(event in EVENTS)) return null;
  const formats = EVENTS[event as EventName] as readonly string[];
  const f = typeof format === "string" && format ? format : formats[0];
  if (!formats.includes(f)) return null;
  return `${page}:${event}:${f}`;
}

/** Only the site itself may count: its own address, its preview deployments and local development. */
export function allowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (protocol !== "https:") return false;
    return hostname === "atlas-sudan.vercel.app" || /^sudan-atlas-site(-[a-z0-9-]+)?\.vercel\.app$/.test(hostname);
  } catch {
    return false;
  }
}

export interface Store { url: string; token: string }

/** The Upstash REST address and token, under whichever names the Vercel integration created. */
export function storeFrom(env: Record<string, string | undefined>): Store | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** Run Redis commands in one request through Upstash's REST API. */
export async function pipeline(store: Store, commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${store.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return ((await res.json()) as { result?: unknown; error?: string }[]).map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

/** HGETALL returns [field, value, field, value, ...]; turn it into an object of numbers. */
export function toCounts(flat: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = Number(flat[i + 1]);
  return out;
}
