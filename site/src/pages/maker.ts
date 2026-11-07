import Papa from "papaparse";
import { match, type MatchResult } from "sudan-atlas";
import { startPage } from "../main";
import "../styles/map.css";
import "../styles/explorer.css";
import "../styles/maker.css";
import { getPlace, placeName } from "../lib/atlas";
import { countEvent } from "../lib/analytics";
import { buildExportSvg, download, downloadPng, downloadSvg, toCsv } from "../lib/export";
import { lang, t, translate } from "../lib/i18n";
import { type LabelMode, MapView } from "../lib/mapview";

startPage("maker");

const $ = <T extends Element>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends Element>(s: string) => Array.from(document.querySelectorAll<T>(s));

interface Sheet { file: string; headers: string[]; rows: string[][] }
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
  if (step === 4) { drawMap(); countEvent("map_made"); }
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
  return { file: file.name, headers, rows: rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")) };
}

function guessColumns(s: Sheet): void {
  const find = (re: RegExp) => s.headers.findIndex((h) => re.test(h));
  const loc = find(/local|mahal|محلي|admin ?2|adm2|district|county|site|town|village|place|name|اسم/i);
  const st = find(/state|wilay|ولاي|admin ?1|adm1|region/i);
  cols.state = st;
  cols.name = loc >= 0 && loc !== st ? loc : st >= 0 ? st : 0;
  if (cols.name === st) cols.state = -1;
  const numeric = s.headers.findIndex((_, i) => i !== cols.name && i !== cols.state &&
    s.rows.slice(0, 50).filter((r) => r[i] !== "").every((r) => !Number.isNaN(Number(r[i].replace(/[, ]/g, "")))));
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

// ---------- step 2: columns ----------
function renderColumns(): void {
  if (!sheet) return;
  $<HTMLElement>("[data-file-summary]").textContent = lang() === "ar"
    ? `${sheet.file}: ${sheet.rows.length} صفًا و${sheet.headers.length} أعمدة.`
    : `${sheet.file}: ${sheet.rows.length} rows, ${sheet.headers.length} columns.`;
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
const finalPcode = (u: Unique): string | null => (u.choice !== undefined ? u.choice : u.result?.pcode ?? null);

$<HTMLButtonElement>("[data-match]").addEventListener("click", async () => {
  if (!sheet) return;
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
    u.result = u.name ? match(u.name, { stateHint: u.state || null, level: level || null }) : undefined;
    if (i % 40 === 0) {
      text.textContent = lang() === "ar" ? `جارٍ مطابقة ${uniques.length} اسمًا… ${i} / ${uniques.length}` : `Matching ${uniques.length} names… ${i} / ${uniques.length}`;
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  $<HTMLElement>("[data-matching]").hidden = true;
  $<HTMLElement>("[data-review]").hidden = false;
  filter = uniques.some((u) => statusOf(u) === "review") ? "review" : "all";
  renderReview();
});

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
  const r = u.result;
  if (!r || !u.name) return t("mk.m.empty", "Empty");
  const names: Record<string, string> = lang() === "ar"
    ? { exact: "مطابقة تامة", variant: "تهجئة معروفة", fuzzy: "تهجئة قريبة", ambiguous: "اسم لأكثر من مكان", none: "لا تطابق" }
    : { exact: "Exact", variant: "Known spelling", fuzzy: "Close spelling", ambiguous: "Could be two places", none: "No match" };
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
    ? `${matchedRows} من ${totalRows} صفًا مطابَقة · ${counts.review} اسمًا يحتاج مراجعتك`
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
    const options = new Set<string>();
    if (u.result?.pcode) options.add(u.result.pcode);
    u.result?.alternatives.forEach((a) => a.pcode && options.add(a.pcode));
    if (u.choice) options.add(u.choice);
    sel.append(new Option(u.result?.method === "ambiguous" && u.choice === undefined ? t("mk.choose", "Choose a place…") : t("mk.nomatch", "No match"), ""));
    options.forEach((p) => sel.append(new Option(placeLabel(p), p)));
    sel.value = finalPcode(u) ?? "";
    sel.addEventListener("change", () => { u.choice = sel.value || null; renderReview(); });
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
  sums.forEach((e, p) => out.set(p, agg === "mean" ? e.sum / e.n : agg === "count" ? e.n : e.sum));
  return out;
}

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
  const col = cols.value >= 0 && sheet ? sheet.headers[cols.value] : lang() === "ar" ? "عدد الصفوف" : "Rows";
  const lv = mapLevel() === 1 ? (lang() === "ar" ? "حسب الولاية" : "by state") : (lang() === "ar" ? "حسب المحلية" : "by locality");
  return `${col} ${lv}`;
}

async function drawMap(): Promise<void> {
  const titleInput = $<HTMLInputElement>("[data-map-title]");
  if (!titleInput.value) titleInput.value = defaultTitle();
  const vals = values();
  const spec = vals.size ? legendSpec(vals, PALETTES[palette].colours) : null;
  if (!map) {
    map = new MapView($<HTMLElement>("[data-mk-map]"), { labels, title: titleInput.value });
    await map.load();
  }
  map.setLevel(mapLevel());
  map.setFill((p) => { const v = vals.get(p); return v === undefined || !spec ? undefined : spec.colourOf(v); });
  map.setLabels(labels);
  const legend = $<HTMLElement>("[data-legend]");
  legend.replaceChildren();
  if (spec) {
    const ramp = Object.assign(document.createElement("span"), { className: "legend__ramp" });
    spec.used.forEach((c, i) => ramp.append(Object.assign(document.createElement("span"), { title: spec.labels[i], style: `background:${c}` })));
    legend.append(ramp, document.createTextNode(`${spec.labels[0]} … ${spec.labels[spec.labels.length - 1]}`),
      Object.assign(document.createElement("span"), { className: "legend__nodata", textContent: t("mk.nodata", "No data") }));
  }
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
$<HTMLSelectElement>("[data-agg]").addEventListener("change", () => drawMap());
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
    const rows: (string | number | null)[][] = [[...sheet.headers, "pcode", "matched_name_en", "matched_name_ar", "match_level", "match_method", "match_score"]];
    sheet.rows.forEach((r, i) => {
      const u = byRow.get(i);
      const p = u ? finalPcode(u) : null;
      const place = p ? getPlace(p) : undefined;
      const method = !u ? "" : u.choice !== undefined ? "reviewed" : u.result?.method ?? "";
      rows.push([...r, p ?? "", place?.name_en ?? "", place?.name_ar ?? "", place?.level ?? "", method, u?.result && p && u.choice === undefined ? u.result.score : ""]);
    });
    download(`${fileStem()}-with-pcodes.csv`, toCsv(rows));
    return;
  }
  if (!map) return;
  const vals = values();
  const spec = vals.size ? legendSpec(vals, PALETTES[palette].colours) : null;
  const legendTitle = cols.value >= 0 && sheet ? sheet.headers[cols.value] : (lang() === "ar" ? "عدد الصفوف" : "Rows");
  const svg = buildExportSvg(map.svg, {
    title: $<HTMLInputElement>("[data-map-title]").value || defaultTitle(),
    rtl: lang() === "ar",
    legend: spec ? { title: legendTitle, colours: spec.used, edges: spec.edges, noData: t("mk.nodata", "No data") } : undefined,
  });
  if (kind === "svg") downloadSvg(`${fileStem()}-map.svg`, svg);
  else await downloadPng(`${fileStem()}-map.png`, svg);
}));

document.addEventListener("sa:lang", () => {
  if (sheet) renderColumns();
  if (uniques.length) renderReview();
  renderPalettes();
  if (map) map.render();
});
