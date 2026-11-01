import { gazetteer, type Place } from "./gazetteer.js";

const byCode = new Map(gazetteer.places.map((p) => [p.pcode, p]));
const sorted = [...gazetteer.places].sort((a, b) => (a.pcode < b.pcode ? -1 : a.pcode > b.pcode ? 1 : 0));

/** The 19 admin-1 units (18 states and the Abyei PCA area), sorted by P-code. */
export function getStates(): Place[] {
  return sorted.filter((p) => p.level === 1).map((p) => ({ ...p }));
}

/** The localities (admin 2), all of them or those in one state, sorted by P-code. */
export function getLocalities(statePcode?: string): Place[] {
  const state = statePcode?.toUpperCase();
  if (state !== undefined && byCode.get(state)?.level !== 1) throw new Error(`No state with P-code "${statePcode}"`);
  return sorted.filter((p) => p.level === 2 && (state === undefined || p.parent_pcode === state)).map((p) => ({ ...p }));
}

/** One place by P-code, or undefined. */
export function getPlace(pcode: string): Place | undefined {
  const place = byCode.get(pcode.toUpperCase());
  return place ? { ...place } : undefined;
}

export const DATA_VERSION: string = gazetteer.version;
