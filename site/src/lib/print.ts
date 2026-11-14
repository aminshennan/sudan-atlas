// An A4 print layout: title, the map as it is on screen, scale bar, north arrow, an inset map of
// Sudan when only part of it is shown, the legend, and the credit, disclaimer and date. It is
// drawn as one SVG page and sent to the browser's print dialog, where "Save as PDF" makes a PDF.
import { drawBandLegend } from "./charts";
import { cloneMap, CREDIT_AR, CREDIT_EN, DISCLAIMER_AR, DISCLAIMER_EN, FONT, FONT_AR, svgText, type LegendSpec } from "./export";
import type { MapView } from "./mapview";

const SVG_NS = "http://www.w3.org/2000/svg";
// A4 portrait at 96 dpi.
const PAGE_W = 794;
const PAGE_H = 1123;
const M = 40;
const INK = "#18181b";
const MUTED = "#52525b";
const DOI = "10.5281/zenodo.24191932";

export interface PrintSpec {
  title: string;
  subtitle?: string;
  legend?: LegendSpec;
  rtl?: boolean;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function buildPrintSvg(map: MapView, spec: PrintSpec): string {
  const rtl = !!spec.rtl;
  const font = rtl ? FONT_AR : FONT;
  const dir = { "font-family": font, direction: rtl ? "rtl" : "ltr", "text-anchor": "start" };
  const x0 = rtl ? PAGE_W - M : M;
  const out = el("svg", { xmlns: SVG_NS, viewBox: `0 0 ${PAGE_W} ${PAGE_H}`, width: "210mm", height: "297mm" });
  out.appendChild(el("rect", { width: PAGE_W, height: PAGE_H, fill: "#fff" }));

  // Title block
  out.appendChild(svgText(x0, M + 22, spec.title, { ...dir, "font-size": 24, "font-weight": 600, fill: INK }));
  let top = M + 34;
  if (spec.subtitle) { out.appendChild(svgText(x0, top + 16, spec.subtitle, { ...dir, "font-size": 12, fill: MUTED })); top += 24; }
  top += 12;

  // Map, scaled to the page width, in a thin frame.
  const { clip, g, w, h } = cloneMap(map.svg, rtl, "sa-print-frame");
  const mapW = PAGE_W - 2 * M;
  const k = mapW / w;
  const mapH = h * k;
  out.appendChild(clip);
  g.setAttribute("transform", `translate(${M} ${top}) scale(${k.toFixed(4)})`);
  out.appendChild(g);
  out.appendChild(el("rect", { x: M, y: top, width: mapW, height: mapH, fill: "none", stroke: "#d4d4d8", "stroke-width": 0.75 }));

  // Scale bar (bottom left of the map, in the reading start corner)
  const bar = map.scaleBar(160);
  if (bar) {
    const len = bar.units * k;
    const sx = rtl ? M + mapW - 28 - len : M + 14; // room for the km label, centred on the bar's end
    const sy = top + mapH - 18;
    const sb = el("g");
    sb.appendChild(el("rect", { x: sx - 6, y: sy - 18, width: len + 12, height: 30, fill: "#fff", opacity: 0.85 }));
    sb.appendChild(el("rect", { x: sx, y: sy, width: len / 2, height: 5, fill: INK }));
    sb.appendChild(el("rect", { x: sx + len / 2, y: sy, width: len / 2, height: 5, fill: "#fff", stroke: INK, "stroke-width": 0.75 }));
    sb.appendChild(svgText(sx, sy - 5, "0", { "font-family": FONT, "font-size": 9, fill: MUTED, "text-anchor": "middle" }));
    sb.appendChild(svgText(sx + len, sy - 5, `${bar.km} ${rtl ? "كم" : "km"}`, { "font-family": FONT, "font-size": 9, fill: MUTED, "text-anchor": "middle" }));
    out.appendChild(sb);
  }

  // North arrow (top corner at the reading end)
  const nx = rtl ? M + 30 : M + mapW - 30;
  const ny = top + 34;
  const north = el("g", { transform: `translate(${nx} ${ny}) rotate(${map.northAngle().toFixed(1)})` });
  north.appendChild(el("circle", { r: 18, fill: "#fff", opacity: 0.85 }));
  north.appendChild(el("path", { d: "M0,-13 L6,7 L0,3 L-6,7 Z", fill: INK }));
  north.appendChild(svgText(0, -15, "N", { "font-family": FONT, "font-size": 9, "font-weight": 700, fill: INK, "text-anchor": "middle" }));
  out.appendChild(north);

  let y = top + mapH + 18;

  // Inset map (when only part of Sudan is shown) and legend, side by side
  const insetSize = 130;
  const inset = map.insetPaths(insetSize);
  if (inset) {
    const ix = rtl ? M : M + mapW - insetSize;
    const ig = el("g", { transform: `translate(${ix} ${y})` });
    ig.appendChild(el("rect", { width: insetSize, height: insetSize, fill: "#fafafa", stroke: "#d4d4d8", "stroke-width": 0.75 }));
    for (const d of inset.states) ig.appendChild(el("path", { d, fill: "#e4e4e7", stroke: "#fff", "stroke-width": 0.5 }));
    if (inset.view) ig.appendChild(el("path", { d: inset.view, fill: "rgba(14,124,102,0.15)", stroke: "#0e7c66", "stroke-width": 1.2 }));
    out.appendChild(ig);
  }
  if (spec.legend) {
    const lx = rtl ? PAGE_W - M : M;
    out.appendChild(svgText(lx, y + 12, spec.legend.title, { ...dir, "font-size": 12, "font-weight": 600, fill: INK }));
    const lg = el("g");
    const size = drawBandLegend(lg, spec.legend.bands, { rtl, swatch: 62 });
    lg.setAttribute("transform", `translate(${rtl ? PAGE_W - M - size.width : M} ${y + 20})`);
    out.appendChild(lg);
    if (spec.legend.note) out.appendChild(svgText(lx, y + 20 + size.height + 14, spec.legend.note, { ...dir, "font-size": 9.5, fill: MUTED }));
  }

  // Footer: source, disclaimer, made with, date
  const date = new Intl.DateTimeFormat(rtl ? "ar-SD-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const lines = [
    rtl ? CREDIT_AR : CREDIT_EN,
    rtl ? DISCLAIMER_AR : DISCLAIMER_EN,
    rtl ? `صُنعت بأطلس السودان · atlas-sudan.vercel.app · doi:${DOI} · ${date}` : `Made with Sudan Atlas · atlas-sudan.vercel.app · doi:${DOI} · ${date}`,
  ];
  lines.forEach((line, i) => out.appendChild(svgText(x0, PAGE_H - M - (lines.length - 1 - i) * 15, line, { ...dir, "font-size": 9, fill: MUTED })));
  return new XMLSerializer().serializeToString(out);
}

/** Send a page to the browser's print dialog (from there, "Save as PDF" makes a PDF). */
export function printSvg(svg: string, title: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>` +
    `<style>@page{size:A4 portrait;margin:0}html,body{margin:0}svg{display:block;width:210mm;height:297mm}</style></head><body>${svg}</body></html>`);
  doc.close();
  const win = frame.contentWindow!;
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", done);
  setTimeout(() => { win.focus(); win.print(); }, 150);
  setTimeout(() => frame.isConnected && frame.remove(), 60_000);
}
