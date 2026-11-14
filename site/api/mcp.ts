// Sudan Atlas as an MCP server (Model Context Protocol), so AI assistants can match Sudanese place
// names to official P-codes and look up places, populations and boundaries. Streamable HTTP,
// stateless and read-only: POST /api/mcp. It runs the published sudan-atlas package, so its answers
// are the packages' answers. Names sent to it are processed to answer the request and not stored
// or logged. Each address may make 60 requests a minute (see _limit.ts); more get 429.
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { DATA_VERSION, getFeature, getLocalities, getPlace, getStates, match, VERSION } from "sudan-atlas";
import { z } from "zod";
import { storeFrom } from "./_counter.js";
import { rateLimit, tooMany } from "./_limit.js";

const MCP_LIMIT = 60;
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const PRIVACY = "Names you send are processed on the Sudan Atlas server to answer the request and are not stored or logged by Sudan Atlas. Only the website's map-maker works entirely in your browser.";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const AREAS: Record<string, number> = readJson("../src/data/areas.json");
const POP: { source: string; reference_date: string; notes: string; population: Record<string, number> } = readJson("../src/data/population.json");

const DOI = "10.5281/zenodo.24191932";
const INSTRUCTIONS = `Sudan Atlas: official names (Arabic and English), P-codes and boundaries for Sudan's 18 states, the Abyei PCA area and 189 localities (OCHA COD-AB v03, data release ${DATA_VERSION}, package ${VERSION}).
Use match_place_name or match_place_names to turn place names written any way (Arabic or English, any spelling) into P-codes. Pass a state hint and a level (1 = state, 2 = locality) when known. When the matcher is not confident, pcode is null and the alternatives are the candidates: ask the user or say so, never pick one silently. "Abyei" alone can mean the Abyei PCA area or the West Kordofan locality.
Boundaries follow COD-AB and do not imply any opinion on the legal status of any territory. Populations are UNFPA/CBS Sudan COD-PS 2025 estimates (mid-2025 projections), not counts.
Privacy: ${PRIVACY}
Cite: Sudan Atlas, https://doi.org/${DOI}. Website: https://atlas-sudan.vercel.app`;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] });
const level = z.union([z.literal(1), z.literal(2)]).optional().describe("1 for states, 2 for localities; leave out if unknown");

function placeSummary(pcode: string) {
  const p = getPlace(pcode);
  if (!p) return null;
  const parent = p.level === 2 ? getPlace(p.parent_pcode) : undefined;
  return { pcode: p.pcode, level: p.level, name_en: p.name_en, name_ar: p.name_ar, state: parent ? { pcode: parent.pcode, name_en: parent.name_en, name_ar: parent.name_ar } : undefined };
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "sudan-atlas", version: VERSION }, { instructions: INSTRUCTIONS });

  server.registerTool("match_place_name", {
    title: "Match a Sudanese place name",
    description: "Match one state or locality name, in Arabic or English and any spelling, to its official P-code. Returns pcode (null when not confident), names, score 0-1, method (exact, variant, fuzzy, ambiguous, none) and up to three alternatives.",
    inputSchema: { name: z.string().min(1).max(200).describe("The place name as written, e.g. 'Elfasher' or 'الفاشر'"), state_hint: z.string().max(100).optional().describe("The state, as a name in any spelling or a P-code such as SD02"), level },
  }, async ({ name, state_hint, level: lv }) => json(match(name, { stateHint: state_hint ?? null, level: lv ?? null })));

  server.registerTool("match_place_names", {
    title: "Match many Sudanese place names",
    description: "Match up to 1,000 names at once (for example a spreadsheet column). Each item can carry its own state hint. Results are in the same order as the input.",
    inputSchema: {
      names: z.array(z.object({ name: z.string().max(200), state_hint: z.string().max(100).optional() })).min(1).max(1000),
      level,
    },
  }, async ({ names, level: lv }) => json(names.map(({ name, state_hint }) => ({ input: name, ...match(name, { stateHint: state_hint ?? null, level: lv ?? null }) }))));

  server.registerTool("search_places", {
    title: "Search Sudan's states and localities",
    description: "Find states and localities whose official English or Arabic name contains the text, best first, with the matcher's answer for misspellings.",
    inputSchema: { query: z.string().min(1).max(100), limit: z.number().int().min(1).max(25).optional() },
  }, async ({ query, limit }) => {
    const fold = (t: string) => t.toLowerCase().normalize("NFKD").replace(/\p{Mn}/gu, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    const q = fold(query.trim());
    const all = [...getStates(), ...getLocalities()];
    const scored = all.map((p) => {
      const names = [fold(p.name_en), fold(p.name_ar)];
      const s = names.some((n) => n === q) ? 3 : names.some((n) => n.startsWith(q)) ? 2 : names.some((n) => n.includes(q)) ? 1 : 0;
      return { p, s };
    }).filter((x) => x.s > 0);
    const best = match(query);
    if (best.pcode && !scored.some((x) => x.p.pcode === best.pcode)) scored.push({ p: getPlace(best.pcode)!, s: 2.5 });
    scored.sort((a, b) => b.s - a.s || a.p.level - b.p.level);
    return json(scored.slice(0, limit ?? 10).map((x) => placeSummary(x.p.pcode)));
  });

  server.registerTool("get_place", {
    title: "Details of a state or locality",
    description: "Official names, level, parent state, localities (for a state), area in km² and estimated population (COD-PS 2025, mid-2025) for a P-code.",
    inputSchema: { pcode: z.string().regex(/^SD\d{2}(\d{3})?$/i).describe("A P-code such as SD02 or SD02114") },
  }, async ({ pcode }) => {
    const code = pcode.toUpperCase();
    const p = placeSummary(code);
    if (!p) return { ...json({ error: `No state or locality has the P-code ${code}.` }), isError: true };
    return json({
      ...p,
      area_km2: AREAS[code] ?? null,
      population_estimate: POP.population[code] ?? null,
      population_source: `${POP.source}, reference date ${POP.reference_date}. ${POP.notes}`,
      localities: p.level === 1 ? getLocalities(code).map((l) => ({ pcode: l.pcode, name_en: l.name_en, name_ar: l.name_ar })) : undefined,
    });
  });

  server.registerTool("list_places", {
    title: "List states or localities",
    description: "All 19 admin-1 units (18 states and the Abyei PCA area), or the localities of the whole country or of one state.",
    inputSchema: { level: z.union([z.literal(1), z.literal(2)]), state_pcode: z.string().regex(/^SD\d{2}$/i).optional() },
  }, async ({ level: lv, state_pcode }) => {
    const places = lv === 1 ? getStates() : getLocalities(state_pcode ? state_pcode.toUpperCase() : undefined);
    return json(places.map((p) => ({ pcode: p.pcode, name_en: p.name_en, name_ar: p.name_ar, parent_pcode: p.parent_pcode })));
  });

  server.registerTool("get_boundary", {
    title: "Boundary of a state or locality",
    description: "The boundary as a GeoJSON Feature (EPSG:4326) with the place's properties. 'light' is small and enough for most maps; 'medium' is more detailed.",
    inputSchema: { pcode: z.string().regex(/^SD\d{2}(\d{3})?$/i), resolution: z.enum(["light", "medium"]).optional() },
  }, async ({ pcode, resolution }) => {
    const code = pcode.toUpperCase();
    if (!getPlace(code)) return { ...json({ error: `No state or locality has the P-code ${code}.` }), isError: true };
    return json(await getFeature(code, resolution ?? "light"));
  });

  return server;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method === "GET" && !(request.headers.get("accept") ?? "").includes("text/event-stream")) {
      // A person opening the address in a browser gets a short explanation instead of an error.
      return new Response(JSON.stringify({ name: "sudan-atlas", version: VERSION, data_version: DATA_VERSION, protocol: "MCP (Streamable HTTP), POST to this address", docs: "https://atlas-sudan.vercel.app/docs/#mcp", doi: DOI, privacy: PRIVACY, rate_limit: `${MCP_LIMIT} requests a minute per address` }, null, 1), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    const limited = await rateLimit(request, "mcp", MCP_LIMIT, storeFrom(env));
    if (!limited.ok) {
      const body = JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: `Too many requests: at most ${MCP_LIMIT} a minute. Try again in ${limited.retryAfter} seconds.` } });
      return tooMany(limited.retryAfter, { "Content-Type": "application/json", ...CORS }, body);
    }
    // Stateless: a new server and transport for each request, answering in plain JSON.
    const server = buildServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};
