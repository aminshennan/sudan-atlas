import Papa from "papaparse";
import { match, type MatchResult } from "sudan-atlas";
import { startPage } from "../main";
import "../styles/map.css";
import "../styles/explorer.css";
import "../styles/maker.css";
import { getPlace, placeName } from "../lib/atlas";
import { countEvent } from "../lib/analytics";
import { drawBandLegend, drawRanking, highlightRanking, type BandLegend, type RankItem } from "../lib/charts";
import { buildExportSvg, download, downloadPng, downloadSvg, toCsv } from "../lib/export";
import { lang, t, translate } from "../lib/i18n";
import { populationOf, POPULATION_SOURCE, POPULATION_SOURCE_AR } from "../lib/population";
import { type LabelMode, MapView } from "../lib/mapview";

startPage("maker");

const $ = <T extends Element>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends Element>(s: string) => Array.from(document.querySelectorAll<T>(s));

/** hxl: the file's HXL hashtag row (#adm2+name, #affected, ...), when it has one. */
interface Sheet { file: string; headers: string[]; rows: string[][]; hxl?: string[] }
type Status = "ok" | "review" | "none" | "fixed";
interface Unique {
  key: string;
  name: string;
  state: string;
  rows: number[];
  result?: MatchResult;
  choice?: string | null; // a reviewer's pick; undefined = not reviewed
}

const PALETTES: Record<string, { label: string; colours: string[] }> = {
  ylgnbu: { label: "Yellow–green–blue", colours: ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"] },
  ylorbr: { label: "Yellow–brown", colours: ["#ffffd4", "#fed98e", "#fe9929", "#d95f0e", "#993404"] },
  viridis: { label: "Viridis", colours: ["#fde725", "#5ec962", "#21918c", "#3b528b", "#440154"] },
};

let sheet: Sheet | null = null;
const cols = { name: -1, state: -1, value: -1 };
let level: 0 | 1 | 2 = 2;
let uniques: Unique[] = [];
let filter: "all" | "review" | "none" = "all";
let palette = "ylgnbu";
let labels: LabelMode = lang() === "ar" ? "ar" : "en";
let map: MapView | null = null;

// ---------- steps ----------
function go(step: number): void {
  $$<HTMLElement>("[data-step]").forEach((s) => (s.hidden = s.dataset.step !== String(step)));
  $$<HTMLElement>("[data-step-tab]").forEach((li) => {
    const n = Number(li.dataset.stepTab);
    li.dataset.state = n < step ? "done" : n === step ? "current" : "todo";
    if (n === step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
  if (step === 4) { drawMap(); countEvent("map_made", "map"); }
}
$$<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.go))));
go(1);

// ---------- step 1: reading the file ----------
const errorBox = $<HTMLElement>("[data-error]");
function showError(message: string): void { errorBox.textContent = message; errorBox.hidden = false; }

const cell = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();

async function readFile(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  let rows: string[][];
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file");
    rows = (await readXlsxFile(file)).map((r) => r.map(cell));
  } else if (name.endsWith(".xls")) {
    throw new Error(t("mk.err.xls", "Old .xls files can't be read. Save the file as .xlsx or .csv and try again."));
  } else {
    const parsed = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) =>
      Papa.parse<string[]>(file, { skipEmptyLines: "greedy", encoding: "UTF-8", complete: resolve, error: reject }));
    rows = parsed.data.map((r) => r.map(cell));
  }
  rows = rows.filter((r) => r.some((c) => c !== ""));
  if (rows.length < 2) throw new Error(t("mk.err.empty", "The file needs a header row and at least one row of data."));
  const headers = rows[0].map((h, i) => h.replace(/^﻿/, "") || `Column ${i + 1}`);
  const width = headers.length;
  const body = rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  // HXL: a row of hashtags straight under the header (humanitarian data's convention). Keep it
  // apart from the data, and use it to pick the columns.
  const hxl = isHxlRow(body[0]) ? body.shift()!.map((c) => c.trim().toLowerCase()) : undefined;
  if (!body.length) throw new Error(t("mk.err.empty", "The file needs a header row and at least one row of data."));
  return { file: file.name, headers, rows: body, hxl };
}

/** True when most filled cells of a row are HXL hashtags, such as #adm2+name or #affected+idps. */
function isHxlRow(row: string[] | undefined): boolean {
  if (!row) return false;
  const filled = row.map((c) => c.trim()).filter(Boolean);
  return filled.length > 0 && filled.filter((c) => /^#[a-z][a-z0-9_]*(\s*\+[a-z][a-z0-9_]*)*$/i.test(c)).length >= Math.max(1, filled.length * 0.6);
}

/** The column whose HXL tag starts with one of these, in order of preference, or -1. */
function hxlColumn(hxl: string[], ...prefixes: string[]): number {
  for (const prefix of prefixes) {
    const i = hxl.findIndex((tag) => tag.replace(/\s+/g, "") === prefix || tag.replace(/\s+/g, "").startsWith(`${prefix}+`));
    if (i >= 0) return i;
  }
  return -1;
}

/** The official place for a P-code written in a cell (SD15 or SD15034), or null. */
function placeFromCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  return /^SD\d{2}(\d{3})?$/.test(code) && getPlace(code) ? code : null;
}

function guessColumns(s: Sheet): void {
  if (s.hxl && guessFromHxl(s, s.hxl)) return;
  const find = (re: RegExp) => s.headers.findIndex((h) => re.test(h));
  const loc = find(/local|mahal|محلي|admin ?2|adm2|district|county|site|town|village|place|name|اسم/i);
  const st = find(/state|wilay|ولاي|admin ?1|adm1|region/i);
  cols.state = st;
  cols.name = loc >= 0 && loc !== st ? loc : st >= 0 ? st : 0;
  if (cols.name === st) cols.state = -1;
  // A value column is mostly numbers; a stray "n/a" or "-" shouldn't hide it (those rows are reported on the map step).
  const numeric = s.headers.findIndex((_, i) => {
    if (i === cols.name || i === cols.state) return false;
    const filled = s.rows.slice(0, 200).map((r) => r[i]).filter((v) => v !== "");
    const numbers = filled.filter((v) => !Number.isNaN(Number(v.replace(/[, ]/g, ""))));
    return numbers.length > 0 && numbers.length >= 0.8 * filled.length;
  });
  cols.value = numeric;
  level = cols.name === st ? 1 : 2;
}

async function load(file: File): Promise<void> {
  errorBox.hidden = true;
  try {
    sheet = await readFile(file);
    guessColumns(sheet);
    renderColumns();
    go(2);
  } catch (e) {
    showError((e as Error).message || t("mk.err.read", "The file could not be read."));
  }
}

const input = $<HTMLInputElement>("[data-file]");
input.addEventListener("change", () => { if (input.files?.[0]) load(input.files[0]); });
const drop = $<HTMLElement>("[data-drop]");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("is-over");
  const f = e.dataTransfer?.files?.[0];
  if (f) load(f);
});
$<HTMLButtonElement>("[data-sample]").addEventListener("click", async () => {
  const res = await fetch("/samples/sudan-atlas-sample.csv");
  load(new File([await res.blob()], "sudan-atlas-sample.csv", { type: "text/csv" }));
});

/** Pick columns from HXL tags; false when the tags name no place column. */
function guessFromHxl(s: Sheet, hxl: string[]): boolean {
  // Prefer locality columns, and a P-code column over a name column (codes match exactly).
  const adm2 = hxlColumn(hxl, "#adm2+code", "#adm2+name", "#adm2");
  const adm1 = hxlColumn(hxl, "#adm1+code", "#adm1+name", "#adm1");
  const place = adm2 >= 0 ? adm2 : adm1 >= 0 ? adm1 : hxlColumn(hxl, "#loc+name", "#loc");
  if (place < 0) return false;
  cols.name = place;
  cols.state = adm2 >= 0 ? hxlColumn(hxl, "#adm1+name", "#adm1+code", "#adm1") : -1;
  level = adm2 >= 0 ? 2 : adm1 >= 0 ? 1 : 0;
  // The figure to map: the usual humanitarian counts, then any numeric indicator.
  cols.value = hxlColumn(hxl, "#affected", "#inneed", "#targeted", "#reached", "#population", "#value", "#indicator");
  return true;
}

// ---------- step 2: columns ----------
function renderColumns(): void {
  if (!sheet) return;
  $<HTMLElement>("[data-file-summary]").textContent = lang() === "ar"
    ? `${sheet.file} · عدد الصفوف: ${sheet.rows.length} · عدد الأعمدة: ${sheet.headers.length}`
    : `${sheet.file}: ${sheet.rows.length} rows, ${sheet.headers.length} columns.`;
  const hxlNote = $<HTMLElement>("[data-hxl-note]");
  hxlNote.hidden = !sheet.hxl;
  if (sheet.hxl) hxlNote.textContent = t("mk.hxl", "HXL hashtags found: the columns were chosen from them, and your file keeps them when you download it.");
  for (const key of ["name", "state", "value"] as const) {
    const sel = $<HTMLSelectElement>(`[data-col="${key}"]`);
    sel.replaceChildren();
    if (key !== "name") sel.append(new Option(key === "state" ? t("mk.col.nostate", "No state column") : t("mk.col.novalue", "No value: count rows"), "-1"));
    sheet.headers.forEach((h, i) => sel.append(new Option(h, String(i))));
    sel.value = String(cols[key]);
    sel.onchange = () => { cols[key] = Number(sel.value); renderPreview(); };
  }
  $$<HTMLButtonElement>("[data-mk-level]").forEach((b) => {
    b.setAttribute("aria-pressed", String(Number(b.dataset.mkLevel) === level));
    b.onclick = () => { level = Number(b.dataset.mkLevel) as 0 | 1 | 2; renderColumns(); };
  });
  renderPreview();
}

function renderPreview(): void {
  if (!sheet) return;
  const table = $<HTMLTableElement>("[data-preview]");
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  sheet.headers.forEach((h, i) => {
    const th = document.createElement("th");
    const role = i === cols.name ? t("mk.col.name", "Place names") : i === cols.state ? t("mk.role.state", "State") : i === cols.value ? t("mk.role.value", "Value") : "";
    th.textContent = role ? `${h} · ${role}` : h;
    head.append(th);
  });
  const body = table.createTBody();
  for (const r of sheet.rows.slice(0, 6)) {
    const tr = body.insertRow();
    r.forEach((c) => (tr.insertCell().textContent = c));
  }
}

// ---------- step 3: matching and review ----------
function statusOf(u: Unique): Status {
  if (u.choice !== undefined) return u.choice ? "fixed" : "none";
  const r = u.result;
  if (!r) return "none";
  if (r.method === "ambiguous") return "review";
  if (!r.pcode) return "none";
  return r.method === "fuzzy" && r.score < 0.9 ? "review" : "ok";
}
/** A P-code in the cell is taken as it is; anything else goes to the matcher. */
function matchCell(name: string, state: string): MatchResult {
  const code = placeFromCode(name);
  if (code && (!level || getPlace(code)!.level === level)) {
    const p = getPlace(code)!;
    return { pcode: p.pcode, name_en: p.name_en, name_ar: p.name_ar, level: p.level, score: 1, method: "exact", alternatives: [] } as MatchResult;
  }
  return match(name, { stateHint: placeFromCode(state) ?? (state || null), level: level || null });
}

const finalPcode = (u: Unique): string | null => (u.choice !== undefined ? u.choice : u.result?.pcode ?? null);

$<HTMLButtonElement>("[data-match]").addEventListener("click", async () => {
  if (!sheet) return;
  // Count the run by file type only (never the file's name or contents).
  const ext = sheet.file.toLowerCase().split(".").pop() ?? "";
  countEvent("match_run", sheet.file === "sudan-atlas-sample.csv" ? "sample" : ext === "xlsx" || ext === "tsv" ? ext : "csv");
  go(3);
  $<HTMLElement>("[data-review]").hidden = true;
  $<HTMLElement>("[data-matching]").hidden = false;
  const groups = new Map<string, Unique>();
  sheet.rows.forEach((r, i) => {
    const name = r[cols.name] ?? "";
    const state = cols.state >= 0 ? r[cols.state] ?? "" : "";
    const key = `${name}\u0000${state}`;
    if (!groups.has(key)) groups.set(key, { key, name, state, rows: [] });
    groups.get(key)!.rows.push(i);
  });
  uniques = [...groups.values()];
  const text = $<HTMLElement>("[data-matching-text]");
  for (let i = 0; i < uniques.length; i++) {
    const u = uniques[i];
    u.result = u.name ? matchCell(u.name, u.state) : undefined;
    if (i % 40 === 0) {
      text.textContent = lang() === "ar" ? `جارٍ مطابقة الأسماء… ${i} من ${uniques.length}` : `Matching ${uniques.length} names… ${i} / ${uniques.length}`;
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  $<HTMLElement>("[data-matching]").hidden = true;
  $<HTMLElement>("[data-review]").hidden = false;
  filter = uniques.some((u) => statusOf(u) === "review") ? "review" : "all";
  renderReview();
});

const SKIP = "__skip";
/** A candidate this far below the best one is not worth offering. */
const WEAK_GAP = 0.1;

/** The places worth offering for a name: the match and close runners-up, plus the reviewer's pick. */
function candidatesFor(u: Unique): string[] {
  const out = new Set<string>();
  const r = u.result;
  if (r?.pcode) out.add(r.pcode);
  if (r) {
    // With no confident answer at all, show every suggestion; otherwise only the close ones.
    const floor = r.method === "none" ? -Infinity : r.score - WEAK_GAP;
    r.alternatives.forEach((a) => { if (a.pcode && a.score >= floor) out.add(a.pcode); });
  }
  if (u.choice) out.add(u.choice);
  return [...out];
}

function placeLabel(pcode: string): string {
  const p = getPlace(pcode);
  if (!p) return pcode;
  const L = lang();
  const parent = p.level === 2 ? getPlace(p.parent_pcode) : undefined;
  return `${placeName(p, L)}${parent ? ` (${placeName(parent, L)})` : ""} · ${pcode}`;
}

function methodLabel(u: Unique): string {
  const s = statusOf(u);
  if (s === "fixed") return t("mk.m.fixed", "Chosen by you");
  if (u.choice === null) return t("mk.m.skipped", "Left off the map by you");
  const r = u.result;
  if (!r || !u.name) return t("mk.m.empty", "Empty");
  const names: Record<string, string> = lang() === "ar"
    ? { exact: "الاسم الرسمي", variant: "صيغة معروفة للاسم", fuzzy: "كتابة قريبة من الاسم", ambiguous: "يحتمل أكثر من مكان", none: "بلا مطابقة" }
    : { exact: "Exact", variant: "Known spelling", fuzzy: "Close spelling", ambiguous: "More than one place", none: "No match" };
  return `${names[r.method] ?? r.method}${r.pcode ? ` · ${r.score.toFixed(2)}` : ""}`;
}

function renderReview(): void {
  const counts = { all: uniques.length, review: 0, none: 0 };
  for (const u of uniques) { const s = statusOf(u); if (s === "review") counts.review++; if (s === "none") counts.none++; }
  (Object.keys(counts) as (keyof typeof counts)[]).forEach((k) => ($<HTMLElement>(`[data-count="${k}"]`).textContent = `· ${counts[k]}`));
  $$<HTMLButtonElement>("[data-filter]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
    b.onclick = () => { filter = b.dataset.filter as typeof filter; renderReview(); };
  });
  const matchedRows = uniques.filter((u) => finalPcode(u)).reduce((n, u) => n + u.rows.length, 0);
  const totalRows = sheet?.rows.length ?? 0;
  $<HTMLElement>("[data-review-summary]").textContent = lang() === "ar"
    ? `الصفوف المطابَقة: ${matchedRows} من ${totalRows} · أسماء بحاجة إلى مراجعتك: ${counts.review}`
    : `${matchedRows} of ${totalRows} rows matched · ${counts.review} names need your review`;

  const order: Record<Status, number> = { review: 0, none: 1, fixed: 2, ok: 3 };
  const shown = uniques
    .filter((u) => filter === "all" || statusOf(u) === filter)
    .sort((a, b) => order[statusOf(a)] - order[statusOf(b)] || (a.result?.score ?? 0) - (b.result?.score ?? 0));
  const table = $<HTMLTableElement>("[data-review-table]");
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  for (const [k, en] of [["mk.th.name", "In your file"], ["mk.th.rows", "Rows"], ["mk.th.match", "Matched place"], ["mk.th.how", "How"], ["mk.th.status", "Status"]]) {
    const th = document.createElement("th");
    th.dataset.i18n = k;
    th.textContent = en;
    head.append(th);
  }
  translate(head);
  const body = table.createTBody();
  for (const u of shown) {
    const s = statusOf(u);
    const tr = body.insertRow();
    tr.className = `is-${s}`;
    const nameCell = tr.insertCell();
    nameCell.append(Object.assign(document.createElement("span"), { className: "review__name", textContent: u.name || "—" }));
    if (u.state) nameCell.append(Object.assign(document.createElement("span"), { className: "review__state", textContent: u.state }));
    tr.insertCell().textContent = String(u.rows.length);

    const sel = document.createElement("select");
    sel.setAttribute("aria-label", `${t("mk.th.match", "Matched place")}: ${u.name}`);
    const undecided = u.result?.method === "ambiguous" && u.choice === undefined;
    if (undecided) sel.append(new Option(t("mk.choose", "Choose a place…"), ""));
    candidatesFor(u).forEach((p) => sel.append(new Option(placeLabel(p), p)));
    sel.append(new Option(t("mk.skip", "No match: leave off the map"), SKIP));
    sel.value = undecided ? "" : finalPcode(u) ?? SKIP;
    sel.addEventListener("change", () => {
      u.choice = sel.value === "" ? undefined : sel.value === SKIP ? null : sel.value;
      renderReview();
    });
    tr.insertCell().append(sel);
    tr.insertCell().textContent = methodLabel(u);
    const status = document.createElement("span");
    status.className = `status status--${s}`;
    status.textContent = { ok: t("mk.st.ok", "Matched"), review: t("mk.st.review", "Needs review"), none: t("mk.st.none", "No match"), fixed: t("mk.st.fixed", "Checked") }[s];
    tr.insertCell().append(status);
  }
}

// ---------- step 4: map and export ----------
function mapLevel(): 1 | 2 {
  if (level) return level;
  let ones = 0, twos = 0;
  for (const u of uniques) { const p = finalPcode(u); const pl = p ? getPlace(p) : undefined; if (pl?.level === 1) ones += u.rows.length; else if (pl) twos += u.rows.length; }
  return ones > twos ? 1 : 2;
}

function values(): Map<string, number> {
  const agg = $<HTMLSelectElement>("[data-agg]").value;
  const sums = new Map<string, { sum: number; n: number }>();
  for (const u of uniques) {
    const p = finalPcode(u);
    if (!p || !sheet) continue;
    for (const i of u.rows) {
      const raw = cols.value >= 0 ? sheet.rows[i][cols.value].replace(/[, ]/g, "") : "1";
      const v = Number(raw);
      if (raw === "" || Number.isNaN(v)) continue;
      const e = sums.get(p) ?? { sum: 0, n: 0 };
      e.sum += cols.value >= 0 ? v : 1;
      e.n += 1;
      sums.set(p, e);
    }
  }
  const out = new Map<string, number>();
  const rate = rateOn();
  sums.forEach((e, p) => {
    const v = agg === "mean" ? e.sum / e.n : agg === "count" ? e.n : e.sum;
    if (!rate) { out.set(p, v); return; }
    const pop = populationOf(p);
    if (pop) out.set(p, (v / pop) * 1000); // places with no population figure are reported, not mapped
  });
  return out;
}

/** Per 1,000 people: chosen, and meaningful (a rate of an average is not). */
function rateOn(): boolean {
  return $<HTMLSelectElement>("[data-rate]").value === "per1000" && $<HTMLSelectElement>("[data-agg]").value !== "mean";
}
const PER_1000 = () => (lang() === "ar" ? "لكل 1,000 نسمة" : "per 1,000 people");

function classes(vals: number[], n: number): number[] {
  const sorted = [...vals].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < n; i++) {
    const b = sorted[Math.min(sorted.length - 1, Math.floor((i * sorted.length) / n))];
    if (!breaks.includes(b) && b > sorted[0]) breaks.push(b);
  }
  return breaks;
}

const nf = (v: number) => new Intl.NumberFormat(lang() === "ar" ? "ar-SD-u-nu-latn" : "en-GB", { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);

function legendSpec(vals: Map<string, number>, colours: string[]) {
  const list = [...vals.values()];
  const breaks = classes(list, colours.length);
  const used = colours.slice(0, breaks.length + 1);
  const min = Math.min(...list), max = Math.max(...list);
  const edges = [min, ...breaks, max];
  const labelsOut = used.map((_, i) => `${nf(edges[i])}–${nf(edges[i + 1])}`);
  const colourOf = (v: number) => used[breaks.filter((b) => v >= b).length];
  return { breaks, used, labels: labelsOut, edges: edges.map(nf), colourOf };
}

function defaultTitle(): string {
  const col = valueTitle();
  const lv = mapLevel() === 1 ? (lang() === "ar" ? "حسب الولاية" : "by state") : (lang() === "ar" ? "حسب المحلية" : "by locality");
  return `${col} ${lv}`;
}

const RANK_EXPORT_LIMIT = 15;

/** Values for the places at the level being mapped, with their legend and chart data. */
function chartData() {
  const lvl = mapLevel();
  const all = values();
  const shown = new Map([...all].filter(([p]) => getPlace(p)?.level === lvl));
  const spec = shown.size ? legendSpec(shown, PALETTES[palette].colours) : null;
  const L = lang();
  const items: RankItem[] = spec
    ? [...shown].map(([pcode, value]) => ({ pcode, value, colour: spec.colourOf(value), name: placeName(getPlace(pcode)!, L) }))
    : [];
  const bands: BandLegend | null = spec ? {
    colours: spec.used,
    edges: spec.edges,
    counts: spec.used.map((c) => items.filter((i) => i.colour === c).length),
    noDataLabel: t("mk.nodata", "No data"),
    noDataCount: (lvl === 1 ? 19 : 189) - shown.size,
    caption: t("mk.bands", "Bars show how many places fall in each colour band"),
  } : null;
  return { shown, spec, items, bands, lvl };
}

function valueTitle(): string {
  const base = cols.value >= 0 && sheet ? sheet.headers[cols.value] : lang() === "ar" ? "عدد الصفوف" : "Rows";
  return rateOn() ? `${base} ${PER_1000()}` : base;
}

function rankSubtitle(n: number, limit?: number): string {
  const ar = lang() === "ar";
  if (limit && n > limit) return ar ? `أعلى ${limit} مكانًا من أصل ${n}` : `Top ${limit} of ${n} places`;
  return ar ? `جميع الأماكن (${n}) · من الأعلى إلى الأدنى` : `All ${n} places, highest first`;
}

/** Why each row is or isn't on the map. */
type RowFate = "on_map" | "needs_review" | "no_match" | "left_unmatched" | "other_level" | "value_not_a_number" | "no_population";

function rowFates(): RowFate[] {
  const fates: RowFate[] = [];
  if (!sheet) return fates;
  const lvl = mapLevel();
  const byRow = new Map<number, Unique>();
  uniques.forEach((u) => u.rows.forEach((i) => byRow.set(i, u)));
  sheet.rows.forEach((r, i) => {
    const u = byRow.get(i);
    const p = u ? finalPcode(u) : null;
    if (!u || !p) {
      fates.push(!u ? "no_match" : u.choice === null ? "left_unmatched" : u.result?.method === "ambiguous" ? "needs_review" : "no_match");
    } else if (getPlace(p)?.level !== lvl) {
      fates.push("other_level");
    } else if (cols.value >= 0 && (r[cols.value].trim() === "" || Number.isNaN(Number(r[cols.value].replace(/[, ]/g, ""))))) {
      fates.push("value_not_a_number");
    } else if (rateOn() && populationOf(p) === undefined) {
      fates.push("no_population");
    } else {
      fates.push("on_map");
    }
  });
  return fates;
}

/** Say plainly which rows the map leaves out, so totals are never quietly wrong. */
function renderUnmapped(): void {
  const box = $<HTMLElement>("[data-unmapped]");
  const counts = new Map<RowFate, number>();
  rowFates().forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
  counts.delete("on_map");
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  box.hidden = total === 0;
  if (!total) return;
  const ar = lang() === "ar";
  const other = mapLevel() === 2 ? (ar ? "ولايات لا محليات" : ["is a state, not a locality", "are states, not localities"]) : (ar ? "محليات لا ولايات" : ["is a locality, not a state", "are localities, not states"]);
  const en: Record<Exclude<RowFate, "on_map">, [string, string]> = {
    needs_review: ["needs review", "need review"],
    no_match: ["has no match", "have no match"],
    left_unmatched: ["was left unmatched by you", "were left unmatched by you"],
    other_level: other as [string, string],
    value_not_a_number: ["has a value that isn't a number", "have values that aren't numbers"],
    no_population: ["is in a place with no population estimate (the Abyei PCA area)", "are in places with no population estimate (the Abyei PCA area)"],
  };
  const arLabels: Record<Exclude<RowFate, "on_map">, string> = {
    needs_review: "بحاجة إلى مراجعة",
    no_match: "بلا مطابقة",
    left_unmatched: "تركتها بلا مطابقة",
    other_level: other as string,
    value_not_a_number: "قيمتها ليست رقمًا",
    no_population: "في مكان بلا تقدير سكاني (منطقة أبيي)",
  };
  const parts = [...counts].map(([f, n]) => {
    const k = f as Exclude<RowFate, "on_map">;
    return ar ? `${arLabels[k]}: ${n}` : `${n} ${en[k][n === 1 ? 0 : 1]}`;
  });
  $<HTMLElement>("[data-unmapped-text]").textContent = ar
    ? `صفوف لا تظهر على الخريطة: ${total} (${parts.join("، ")}).`
    : `${total} ${total === 1 ? "row is" : "rows are"} not on the map: ${parts.join(", ")}.`;
  $<HTMLElement>("[data-unmapped-go]").hidden = !counts.has("needs_review") && !counts.has("no_match") && !counts.has("left_unmatched");
}

async function drawMap(): Promise<void> {
  const titleInput = $<HTMLInputElement>("[data-map-title]");
  retitle();
  const rankSvg = $<SVGSVGElement>("[data-rank-svg]");
  if (!map) {
    map = new MapView($<HTMLElement>("[data-mk-map]"), {
      labels, zoom: true, title: titleInput.value,
      onHover: (pcode) => { highlightRanking(rankSvg, pcode); revealRow(pcode); },
    });
    await map.load();
  }
  map.setLevel(mapLevel());
  const { spec, items, bands } = chartData();
  map.setFill((p) => { const v = items.find((i) => i.pcode === p); return v?.colour; });
  map.setLabels(labels);
  renderUnmapped();

  const rtl = lang() === "ar";
  const ranking = $<HTMLElement>("[data-ranking]");
  ranking.hidden = !items.length;
  if (items.length) {
    $<HTMLElement>("[data-rank-sub]").textContent = `${valueTitle()} · ${rankSubtitle(items.length)}`;
    drawRanking(rankSvg, items, { rtl, format: nf, width: 300, onHover: (p) => { map?.highlight(p); highlightRanking(rankSvg, p); } });
    rankSvg.setAttribute("aria-label", `${t("mk.rank", "Ranking")}: ${rankSubtitle(items.length)}`);
  }

  const legendBox = $<HTMLElement>("[data-legend-box]");
  legendBox.hidden = !spec || !bands;
  if (spec && bands) {
    $<HTMLElement>("[data-legend-title]").textContent = valueTitle();
    const legendSvg = $<SVGSVGElement>("[data-legend]");
    const size = drawBandLegend(legendSvg, bands, { rtl });
    legendSvg.setAttribute("width", String(size.width));
    legendSvg.setAttribute("aria-label", spec.labels.map((l, i) => `${l}: ${bands.counts[i]}`).join(", "));
  }
}

/** Keep the hovered place's row in view inside the ranking list, without moving the page. */
function revealRow(pcode: string | null): void {
  if (!pcode) return;
  const scroller = $<HTMLElement>("[data-rank-scroll]");
  const row = scroller.querySelector<SVGGElement>(`g.rank-row[data-pcode="${pcode}"]`);
  if (!row) return;
  const r = row.getBoundingClientRect(), box = scroller.getBoundingClientRect();
  if (r.top < box.top) scroller.scrollTop -= box.top - r.top + 8;
  else if (r.bottom > box.bottom) scroller.scrollTop += r.bottom - box.bottom + 8;
}

function renderPalettes(): void {
  const box = $<HTMLElement>("[data-palettes]");
  box.replaceChildren();
  for (const [key, p] of Object.entries(PALETTES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(key === palette));
    const ramp = Object.assign(document.createElement("span"), { className: "ramp" });
    p.colours.forEach((c) => ramp.append(Object.assign(document.createElement("span"), { style: `background:${c}` })));
    b.append(ramp, document.createTextNode(t(`pal.${key}`, p.label)));
    b.addEventListener("click", () => { palette = key; renderPalettes(); drawMap(); });
    box.append(b);
  }
}
renderPalettes();
// Rates only make sense for totals and counts, so averages switch the rate option off.
const syncRate = () => {
  const mean = $<HTMLSelectElement>("[data-agg]").value === "mean";
  const rate = $<HTMLSelectElement>("[data-rate]");
  rate.disabled = mean;
  if (mean) rate.value = "total";
  $<HTMLElement>("[data-rate-note]").hidden = !rateOn();
};
$<HTMLSelectElement>("[data-agg]").addEventListener("change", () => { syncRate(); retitle(); drawMap(); });
$<HTMLSelectElement>("[data-rate]").addEventListener("change", () => { syncRate(); retitle(); drawMap(); });
/** Follow the title along with the choices, unless the user has typed their own. */
let lastDefaultTitle = "";
function retitle(): void {
  const input = $<HTMLInputElement>("[data-map-title]");
  if (!input.value || input.value === lastDefaultTitle) input.value = defaultTitle();
  lastDefaultTitle = defaultTitle();
}
$$<HTMLButtonElement>("[data-mk-labels]").forEach((b) => b.addEventListener("click", () => {
  labels = b.dataset.mkLabels as LabelMode;
  $$<HTMLButtonElement>("[data-mk-labels]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  map?.setLabels(labels);
}));

const fileStem = () => (sheet?.file ?? "sudan-atlas").replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-");

$$<HTMLButtonElement>("[data-mk-export]").forEach((b) => b.addEventListener("click", async () => {
  const kind = b.dataset.mkExport;
  countEvent(kind === "csv" ? "file_export" : "map_export", kind);
  if (kind === "csv") {
    if (!sheet) return;
    const byRow = new Map<number, Unique>();
    uniques.forEach((u) => u.rows.forEach((i) => byRow.set(i, u)));
    // Every row says what happened to it: match_status for the match, on_map and not_on_map_reason
    // for whether the map shows it, so nothing drops out unseen.
    const fates = rowFates();
    const rows: (string | number | null)[][] = [[...sheet.headers, "pcode", "matched_name_en", "matched_name_ar", "match_level", "match_method", "match_score", "match_status", "on_map", "not_on_map_reason"]];
    if (sheet.hxl) {
      // Keep the HXL row, and tag the columns we add so HXL tools understand them too.
      const adm = mapLevel() === 1 ? "#adm1" : "#adm2";
      rows.push([...sheet.hxl, `${adm}+code`, `${adm}+name+i_en`, `${adm}+name+i_ar`, "#meta+level", "#meta+match_method", "#meta+match_score", "#meta+match_status", "#meta+on_map", "#meta+reason"]);
    }
    sheet.rows.forEach((r, i) => {
      const u = byRow.get(i);
      const p = u ? finalPcode(u) : null;
      const place = p ? getPlace(p) : undefined;
      const method = !u ? "" : u.choice !== undefined ? "reviewed" : u.result?.method ?? "";
      const status = !u || !u.name ? "empty" : u.choice === null ? "left unmatched" : u.choice ? "chosen in review" : !p ? (u.result?.method === "ambiguous" ? "needs review" : "no match") : statusOf(u) === "review" ? "matched, worth checking" : "matched";
      const fate = fates[i];
      rows.push([...r, p ?? "", place?.name_en ?? "", place?.name_ar ?? "", place?.level ?? "", method, u?.result && p && u.choice === undefined ? u.result.score : "",
        status, fate === "on_map" ? "yes" : "no", fate === "on_map" ? "" : fate.replace(/_/g, " ")]);
    });
    download(`${fileStem()}-with-pcodes.csv`, toCsv(rows));
    return;
  }
  if (!map) return;
  const { items, bands } = chartData();
  const svg = map.withExportLabels((mapSvg) => buildExportSvg(mapSvg, {
    title: $<HTMLInputElement>("[data-map-title]").value || defaultTitle(),
    subtitle: rateOn() ? `${lang() === "ar" ? "لكل 1,000 نسمة، حسب" : "Per 1,000 people, using population estimates from"} ${lang() === "ar" ? POPULATION_SOURCE_AR : POPULATION_SOURCE}` : undefined,
    rtl: lang() === "ar",
    legend: bands ? { title: valueTitle(), bands } : undefined,
    side: items.length ? { title: t("mk.rank", "Ranking"), subtitle: rankSubtitle(items.length, RANK_EXPORT_LIMIT), items, format: nf, limit: RANK_EXPORT_LIMIT } : undefined,
  }));
  if (kind === "svg") downloadSvg(`${fileStem()}-map.svg`, svg);
  else await downloadPng(`${fileStem()}-map.png`, svg);
}));

document.addEventListener("sa:lang", () => {
  if (sheet) renderColumns();
  if (uniques.length) renderReview();
  renderPalettes();
  if (map) void drawMap();
});

$<HTMLButtonElement>("[data-unmapped-go]").addEventListener("click", () => {
  filter = uniques.some((u) => statusOf(u) === "review") ? "review" : uniques.some((u) => statusOf(u) === "none") ? "none" : "all";
  renderReview();
  go(3);
});
