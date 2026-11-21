// Villages, towns and camps, loaded only when asked for (they are much larger than the rest of the data).
// Each is placed in its state and locality by its coordinates. OpenStreetMap's are in their own file under
// the ODbL (© OpenStreetMap contributors); GeoNames (CC BY 4.0) and OCHA's IDP camp list (CC0) in the other.
import { loadData } from "./boundaries.js";

export interface Settlement {
  id: string;
  name: string;
  names: string[];
  kind: string;
  lat: number;
  lon: number;
  /** The locality it falls in. */
  pcode: string;
  /** The state it falls in. */
  state: string;
}

/** What a match result says about the settlement it found. */
export interface SettlementRecord {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
}

export const SETTLEMENT_FILES = ["settlements.json", "settlements_osm.json"] as const;

let loaded: Settlement[] | null = null;
let loading: Promise<Settlement[]> | null = null;

/**
 * Load the villages, towns and camps, once. Needed before match(name, { settlements: true }).
 * In Node they are read from this package; in a browser they are fetched (see setDataUrl).
 */
export function loadSettlements(): Promise<Settlement[]> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= Promise.all(SETTLEMENT_FILES.map((f) => loadData<{ settlements: Settlement[] }>(f)))
    .then((docs) => (loaded = docs.flatMap((d) => d.settlements)))
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** The loaded settlements, or null if loadSettlements() has not finished. */
export function settlementsLoaded(): Settlement[] | null {
  return loaded;
}
