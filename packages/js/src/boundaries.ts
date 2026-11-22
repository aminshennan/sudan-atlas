// Boundary geometry, loaded only when asked for, so the core package stays small.
// In Node the files are read from this package's data/ folder; in a browser they are fetched
// from jsDelivr (or from the address given to setDataUrl).
import pkg from "../package.json";
import { getPlace } from "./places.js";

export const RESOLUTIONS = ["detailed", "medium", "light"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export interface Feature {
  type: "Feature";
  properties: { pcode: string; name_en: string; name_ar: string; level: number; parent_pcode: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export const CDN_DATA_URL = `https://cdn.jsdelivr.net/npm/sudan-atlas@${pkg.version}/data/`;
const isNode = typeof process !== "undefined" && !!process.versions?.node;
let dataUrl: string | undefined;
const cache = new Map<string, Promise<Map<string, Feature>>>();

/**
 * Load boundary files from another address, for example your own copy of this package's data/ folder.
 * In a browser a relative address ("/static/sudan-atlas/") is resolved against the page.
 */
export function setDataUrl(url: string): void {
  const base = typeof location !== "undefined" ? location.href : undefined;
  const absolute = new URL(url.endsWith("/") ? url : `${url}/`, base).href;
  dataUrl = absolute;
  cache.clear();
}

function packageDataUrl(): string {
  return new URL("../data/", import.meta.url).href;
}

async function readJson(url: string): Promise<FeatureCollection> {
  if (url.startsWith("file:")) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    return JSON.parse(await readFile(fileURLToPath(url), "utf8"));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  return response.json();
}

async function load(path: string): Promise<FeatureCollection> {
  if (dataUrl) return readJson(new URL(path, dataUrl).href);
  if (!isNode) return readJson(new URL(path, CDN_DATA_URL).href);
  try {
    return await readJson(new URL(path, packageDataUrl()).href);
  } catch {
    // Bundled into another build (a server framework, say), the files may not sit beside the code.
    return readJson(new URL(path, CDN_DATA_URL).href);
  }
}

function features(resolution: Resolution, level: number): Promise<Map<string, Feature>> {
  const key = `${resolution}/adm${level}`;
  let found = cache.get(key);
  if (!found) {
    found = load(`boundaries/${key}.geojson`).then((c) => new Map(c.features.map((f) => [f.properties.pcode, f])));
    found.catch(() => cache.delete(key));
    cache.set(key, found);
  }
  return found;
}

/** The GeoJSON Feature for a state or locality, at "detailed", "medium" or "light" resolution. */
export async function getFeature(pcode: string, resolution: Resolution = "medium"): Promise<Feature> {
  if (!RESOLUTIONS.includes(resolution)) throw new Error(`resolution must be one of ${RESOLUTIONS.join(", ")}`);
  const place = getPlace(pcode);
  if (!place) throw new Error(`No place with P-code "${pcode}"`);
  const feature = (await features(resolution, place.level)).get(place.pcode);
  if (!feature) throw new Error(`No ${resolution} boundary for ${place.pcode}`);
  return structuredClone(feature);
}
