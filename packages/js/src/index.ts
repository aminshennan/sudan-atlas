/**
 * Sudan Atlas: official codes, names and boundaries for Sudan's states and localities,
 * with a matcher for messy Arabic and English place names.
 *
 *   import { match, getStates, getLocalities, getFeature } from "sudan-atlas";
 *   match("El Fasher", { level: 2 }).pcode; // "SD02114"
 */
import pkg from "../package.json";

export { match, Matcher, DEFAULT_THRESHOLD, DEFAULT_MARGIN } from "./match.js";
export type { MatchResult, MatchOptions, MatcherOptions, Candidate, Method } from "./match.js";
export { getStates, getLocalities, getPlace, DATA_VERSION } from "./places.js";
export { getFeature, setDataUrl, RESOLUTIONS, CDN_DATA_URL } from "./boundaries.js";
export type { Feature, Resolution } from "./boundaries.js";
export type { Place } from "./gazetteer.js";

export const VERSION: string = pkg.version;
