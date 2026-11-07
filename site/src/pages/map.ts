import { startPage } from "../main";
import "../styles/map.css";
import "../styles/home.css";
import "../styles/explorer.css";
import { getLocalities, getPlace, getStates, placeName } from "../lib/atlas";
import AREAS from "../data/areas.json";
import { buildExportSvg, download, downloadPng, downloadSvg, toCsv } from "../lib/export";
import { lang, t } from "../lib/i18n";
import { type LabelMode, MapView } from "../lib/mapview";
import { renderPlaceCard } from "../lib/placecard";
import { bindSearch } from "../lib/search";

startPage("map");

const $ = <T extends Element>(s: string) => document.querySelector<T>(s)!;
const params = new URLSearchParams(location.search);
const state = {
  level: (params.get("level") === "2" ? 2 : 1) as 1 | 2,
  focus: params.get("focus"),
  selected: params.get("place"),
  labels: (params.get("labels") as LabelMode | null) ?? (lang() === "ar" ? "ar" : "en") as LabelMode,
};

const map = new MapView($<HTMLElement>("[data-map]"), {
  labels: state.labels,
  title: "Map of Sudan's states and localities",
  onSelect: (pcode) => select(pcode),
});

function syncUrl(): void {
  const p = new URLSearchParams();
  if (state.level === 2) p.set("level", "2");
  if (state.focus) p.set("focus", state.focus);
  if (state.selected) p.set("place", state.selected);
  if (params.get("lang")) p.set("lang", lang());
  history.replaceState(null, "", `${location.pathname}${p.size ? `?${p}` : ""}`);
}

function pressed(selector: string, value: string): void {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((b) =>
    b.setAttribute("aria-pressed", String(Object.values(b.dataset).includes(value))));
}

function renderCrumbs(): void {
  const box = $<HTMLElement>("[data-crumbs]");
  box.replaceChildren();
  const L = lang();
  const add = (label: string, onClick?: () => void) => {
    const sep = Object.assign(document.createElement("span"), { className: "crumbs__sep", textContent: L === "ar" ? "‹" : "›" });
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: label });
    if (onClick) b.addEventListener("click", onClick); else b.setAttribute("aria-current", "location");
    box.append(sep, b);
  };
  const sel = state.selected ? getPlace(state.selected) : undefined;
  const statePcode = state.focus ?? (sel ? (sel.level === 1 ? sel.pcode : sel.parent_pcode) : null);
  const st = statePcode ? getPlace(statePcode) : undefined;
  if (st) add(placeName(st, L), sel?.level === 2 ? () => select(st.pcode) : undefined);
  if (sel?.level === 2) add(placeName(sel, L));
  $<HTMLElement>("[data-crumb-root]").toggleAttribute("aria-current", !st);
}

function renderDetails(): void {
  renderPlaceCard($<HTMLElement>("[data-details]"), state.selected, map, {
    onLocality: (pcode) => { focus(getPlace(pcode)!.parent_pcode); select(pcode); },
    onFocusState: (pcode) => { focus(pcode); select(pcode); },
  });
}

function select(pcode: string | null): void {
  state.selected = pcode;
  map.select(pcode);
  renderDetails();
  renderCrumbs();
  syncUrl();
}

function focus(statePcode: string | null): void {
  state.focus = statePcode;
  if (statePcode) state.level = 2;
  map.setFocus(statePcode);
  pressed("[data-level]", String(map.currentLevel));
  renderCrumbs();
  syncUrl();
}

function setLevel(level: 1 | 2): void {
  state.level = level;
  if (level === 1) { state.focus = null; map.setFocus(null); }
  map.setLevel(level);
  pressed("[data-level]", String(level));
  syncUrl();
}

function setLabels(mode: LabelMode): void {
  state.labels = mode;
  map.setLabels(mode);
  pressed("[data-labels]", mode);
}

document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((b) =>
  b.addEventListener("click", () => setLevel(b.dataset.level === "2" ? 2 : 1)));
document.querySelectorAll<HTMLButtonElement>("[data-labels]").forEach((b) =>
  b.addEventListener("click", () => setLabels(b.dataset.labels as LabelMode)));
$<HTMLButtonElement>("[data-crumb-root]").addEventListener("click", () => { focus(null); setLevel(1); select(null); });

bindSearch($<HTMLInputElement>("#place-search"), $<HTMLUListElement>("#place-results"), (pcode) => {
  const place = getPlace(pcode)!;
  if (place.level === 2) focus(place.parent_pcode);
  else if (state.level === 2) focus(place.pcode);
  select(pcode);
});

// Export menu
const toggle = $<HTMLButtonElement>("[data-export-toggle]");
const menu = $<HTMLElement>("#export-menu");
const openMenu = (open: boolean) => { menu.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); if (open) menu.querySelector("button")?.focus(); };
toggle.addEventListener("click", () => openMenu(menu.hidden));
document.addEventListener("click", (e) => { if (!menu.hidden && !(e.target as Element).closest(".export")) openMenu(false); });
menu.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "escape") { openMenu(false); toggle.focus(); }
  const target = menu.querySelector<HTMLButtonElement>(`[data-export="${({ s: "svg", p: "png", c: "csv" } as Record<string, string>)[key]}"]`);
  if (target) { e.preventDefault(); target.click(); }
});

function exportTitle(): { title: string; file: string } {
  const L = lang();
  const st = state.focus ? getPlace(state.focus) : undefined;
  if (st) return { title: L === "ar" ? `محليات ولاية ${st.name_ar}` : `${st.name_en}: localities`, file: `sudan-${st.pcode.toLowerCase()}-localities` };
  return state.level === 1
    ? { title: L === "ar" ? "ولايات السودان" : "Sudan: states", file: "sudan-states" }
    : { title: L === "ar" ? "محليات السودان" : "Sudan: localities", file: "sudan-localities" };
}

menu.querySelectorAll<HTMLButtonElement>("[data-export]").forEach((b) => b.addEventListener("click", async () => {
  openMenu(false);
  const { title, file } = exportTitle();
  const kind = b.dataset.export;
  if (kind === "csv") {
    const places = state.focus ? getLocalities(state.focus) : state.level === 1 ? getStates() : getLocalities();
    const rows: (string | number | undefined)[][] = [["pcode", "level", "name_en", "name_ar", "parent_pcode", "area_km2"]];
    for (const p of places) rows.push([p.pcode, p.level, p.name_en, p.name_ar, p.parent_pcode, (AREAS as Record<string, number>)[p.pcode]]);
    download(`${file}.csv`, toCsv(rows));
    return;
  }
  const svg = buildExportSvg(map.svg, { title, rtl: lang() === "ar" });
  if (kind === "svg") downloadSvg(`${file}.svg`, svg);
  else await downloadPng(`${file}.png`, svg);
}));

document.addEventListener("sa:lang", () => {
  if (!params.get("labels")) setLabels(lang() === "ar" ? "ar" : "en");
  map.render();
  renderDetails();
  renderCrumbs();
});

map.load().then(() => {
  $<HTMLElement>("[data-loading]").hidden = true;
  pressed("[data-labels]", state.labels);
  if (state.focus && getPlace(state.focus)?.level === 1) focus(state.focus);
  else setLevel(state.level);
  select(state.selected && getPlace(state.selected) ? state.selected.toUpperCase() : null);
}).catch((err: Error) => {
  $<HTMLElement>("[data-loading]").textContent = err.message;
});
