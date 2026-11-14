// Boundaries and place facts for the site. Geometry comes from the repository's medium-resolution
// TopoJSON (copied to /atlas-data/ at build time); names and P-codes come from the sudan-atlas package.
import { geoArea } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { getLocalities, getPlace, getStates } from "sudan-atlas";
import { feature } from "topojson-client";
import AREAS from "../data/areas.json";
import type { Lang } from "./i18n";

export interface PlaceProps {
  pcode: string;
  name_en: string;
  name_ar: string;
  level: number;
  parent_pcode: string;
}
export type AdmFeature = Feature<Polygon | MultiPolygon, PlaceProps>;

export const DATA_BASE = "/atlas-data/boundaries";
const cache = new Map<string, Promise<AdmFeature[]>>();

// d3-geo wants exterior rings clockwise (the opposite of RFC 7946). A ring wound the other way is read
// as "the whole globe except this shape", whose area is more than a hemisphere: reverse those.
function rewind(f: AdmFeature): AdmFeature {
  if (geoArea(f) <= 2 * Math.PI) return f;
  const rev = (rings: Position[][]) => rings.map((r) => [...r].reverse());
  const g = f.geometry;
  const geometry = g.type === "Polygon"
    ? { ...g, coordinates: rev(g.coordinates) }
    : { ...g, coordinates: g.coordinates.map(rev) };
  return { ...f, geometry } as AdmFeature;
}

export function loadLevel(level: 1 | 2, resolution: "detailed" | "medium" | "light" = "medium"): Promise<AdmFeature[]> {
  const key = `${resolution}/${level}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`${DATA_BASE}/${resolution}/adm${level}.topojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load boundaries (${r.status})`);
        return r.json();
      })
      .then((topo) => {
        const name = Object.keys(topo.objects)[0];
        const fc = feature(topo, topo.objects[name]) as unknown as FeatureCollection<Polygon | MultiPolygon, PlaceProps>;
        return fc.features.map(rewind);
      }));
  }
  return cache.get(key)!;
}

export function placeName(p: { name_en: string | null; name_ar: string | null }, lang: Lang): string {
  return (lang === "ar" ? p.name_ar : p.name_en) ?? "";
}

/**
 * Area in km² from the detailed COD-AB boundaries in an equal-area projection (precomputed by
 * scripts/areas.py), rounded to the nearest thousand, or hundred below 10,000 km².
 */
export function areaKm2(pcode: string): number | undefined {
  const km2 = (AREAS as Record<string, number>)[pcode];
  if (km2 === undefined) return undefined;
  return km2 >= 10000 ? Math.round(km2 / 1000) * 1000 : Math.round(km2 / 100) * 100;
}

export { getLocalities, getPlace, getStates };
