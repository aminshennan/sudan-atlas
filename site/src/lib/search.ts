// Place search: an accessible combobox over the 208 official names in both languages,
// with the sudan-atlas matcher as a fallback so misspellings ("Elfasher") still find the place.
import { match } from "sudan-atlas";
import { getLocalities, getPlace, getStates, placeName } from "./atlas";
import { lang, t } from "./i18n";

interface Entry { pcode: string; level: number; en: string; ar: string; keys: string[] }

const fold = (s: string) => s.normalize("NFKD").replace(/\p{Mn}/gu, "").toLowerCase()
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

let index: Entry[] | null = null;
function entries(): Entry[] {
  index ??= [...getStates(), ...getLocalities()].map((p) => ({
    pcode: p.pcode, level: p.level, en: p.name_en, ar: p.name_ar, keys: [fold(p.name_en), fold(p.name_ar), p.pcode.toLowerCase()],
  }));
  return index;
}

/** The matcher's own threshold: a suggestion scoring lower than this is a guess, not a result. */
const SUGGEST_MIN = 0.82;

/**
 * Places for a query, best first: an exact name, then the matcher's confident answer (so a known
 * spelling such as "الابيض" finds Sheikan before White Nile, which merely contains the word), then
 * names starting with the query, names with a word starting with it, and names containing it.
 * Close misspellings come from the matcher, but only at or above its threshold; nonsense finds nothing.
 */
export function searchPlaces(query: string, limit = 8): Entry[] {
  const q = fold(query);
  if (!q) return [];
  const score = new Map<string, number>();
  const offer = (pcode: string, s: number) => score.set(pcode, Math.max(score.get(pcode) ?? 0, s));
  for (const e of entries()) {
    if (e.keys.some((k) => k === q)) offer(e.pcode, 100);
    else if (e.keys.some((k) => k.startsWith(q))) offer(e.pcode, 80);
    else if (e.keys.some((k) => k.split(" ").some((w) => w.startsWith(q)))) offer(e.pcode, 70);
    else if (q.length >= 3 && e.keys.some((k) => k.includes(q))) offer(e.pcode, 50);
  }
  if (q.length >= 3) {
    const r = match(query);
    if (r.pcode) offer(r.pcode, r.method === "fuzzy" ? 85 : 95);
    for (const a of r.alternatives) if (a.pcode && a.score >= SUGGEST_MIN) offer(a.pcode, 60 * a.score);
  }
  const byPcode = new Map(entries().map((e) => [e.pcode, e]));
  return [...score]
    .sort((a, b) => b[1] - a[1] || byPcode.get(a[0])!.level - byPcode.get(b[0])!.level || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([pcode]) => byPcode.get(pcode)!);
}

export function bindSearch(input: HTMLInputElement, list: HTMLUListElement, onPick: (pcode: string) => void): void {
  let results: Entry[] = [];
  let active = -1;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", list.id);
  list.setAttribute("role", "listbox");

  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
  const render = () => {
    list.replaceChildren();
    results.forEach((e, i) => {
      const li = document.createElement("li");
      li.id = `${list.id}-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      const L = lang();
      const parent = e.level === 2 ? getPlace(getPlace(e.pcode)!.parent_pcode) : undefined;
      const main = Object.assign(document.createElement("span"), { className: "search__name", textContent: L === "ar" ? e.ar : e.en });
      const sub = Object.assign(document.createElement("span"), {
        className: "search__sub",
        textContent: `${e.level === 1 ? t("map.state", "State") : `${t("map.locality", "Locality")}${parent ? ` · ${placeName(parent, L)}` : ""}`} · ${e.pcode}`,
      });
      li.append(main, sub);
      li.addEventListener("mousedown", (ev) => { ev.preventDefault(); pick(i); });
      list.append(li);
    });
    const empty = results.length === 0 && fold(input.value).length >= 2;
    if (empty) {
      list.append(Object.assign(document.createElement("li"), { className: "search__empty", textContent: t("map.search.none", "No places match") }));
    }
    list.hidden = results.length === 0 && !empty;
    input.setAttribute("aria-expanded", String(results.length > 0));
    if (active >= 0) input.setAttribute("aria-activedescendant", `${list.id}-${active}`);
  };
  const pick = (i: number) => {
    const e = results[i];
    if (!e) return;
    input.value = lang() === "ar" ? e.ar : e.en;
    close();
    onPick(e.pcode);
  };
  input.addEventListener("input", () => { results = searchPlaces(input.value); active = results.length ? 0 : -1; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { active = Math.min(results.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === "Enter") { pick(active); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });
  input.addEventListener("blur", () => setTimeout(close, 100));
  close();
}
