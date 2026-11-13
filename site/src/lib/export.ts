// Map exports. The SVG is a copy of what is on screen with every style written out, plus a title,
// an optional legend and the source credit, so it opens the same in any editor. The PNG is that
// SVG drawn at twice its size. Everything happens in the browser; nothing is sent anywhere.
import { drawBandLegend, drawRanking, type BandLegend, type RankItem } from "./charts";

const SVG_NS = "http://www.w3.org/2000/svg";
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const FONT_AR = "'IBM Plex Sans Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, sans-serif";
export const CREDIT_EN = "Boundaries: OCHA COD-AB Sudan v03 (CC BY 3.0 IGO). Names and P-codes: Sudan Atlas (CC BY 4.0).";
export const DISCLAIMER_EN = "Boundaries are shown for humanitarian and research use and do not imply any opinion on the legal status of any territory.";
export const DISCLAIMER_AR = "تُعرض الحدود للأغراض الإنسانية والبحثية، ولا يعبّر رسمها عن أي موقف من الوضع القانوني لأي إقليم.";
export const CREDIT_AR = "مصدر الحدود: أوتشا، مجموعة COD-AB للسودان، الإصدار الثالث (CC BY 3.0 IGO). الأسماء والرموز: أطلس السودان (CC BY 4.0).";

export interface LegendSpec {
  title: string;
  bands: BandLegend;
}
export interface SideChart {
  title: string;
  subtitle?: string;
  items: RankItem[];
  format: (v: number) => string;
  limit: number;
}
export interface ExportSpec {
  title: string;
  subtitle?: string;
  legend?: LegendSpec;
  /** A ranked bar chart beside the map. */
  side?: SideChart;
  rtl?: boolean;
}

const SIDE_W = 340;
const SIDE_GAP = 28;

const PROPS = ["fill", "stroke", "stroke-width", "stroke-linejoin", "opacity", "font-size", "font-weight", "paint-order", "vector-effect"] as const;

function inlineStyles(source: Element, target: Element): void {
  const cs = getComputedStyle(source);
  for (const prop of PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v && v !== "normal") target.setAttribute(prop, v);
  }
  target.removeAttribute("class");
  const sourceKids = source.children;
  const targetKids = target.children;
  for (let i = 0; i < sourceKids.length; i++) inlineStyles(sourceKids[i], targetKids[i]);
}

function text(x: number, y: number, content: string, attrs: Record<string, string | number>): SVGTextElement {
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, String(v));
  t.textContent = content;
  return t;
}

/** A standalone SVG of the map, ready to save. */
export function buildExportSvg(mapSvg: SVGSVGElement, spec: ExportSpec): string {
  const [, , w, h] = (mapSvg.getAttribute("viewBox") ?? "0 0 800 760").split(" ").map(Number);
  const top = spec.subtitle ? 84 : 64;
  const legendH = spec.legend ? 120 : 0;
  const bottom = 60 + legendH; // credit and disclaimer lines
  const sideW = spec.side ? SIDE_W + SIDE_GAP : 0;
  const W = w + sideW;
  // In Arabic the chart sits on the left and the map on the right.
  const mapX = spec.rtl ? sideW : 0;
  const H = h + top + bottom;
  const out = document.createElementNS(SVG_NS, "svg");
  out.setAttribute("xmlns", SVG_NS);
  out.setAttribute("viewBox", `0 0 ${W} ${H}`);
  out.setAttribute("width", String(W));
  out.setAttribute("height", String(H));
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  out.appendChild(bg);

  const font = spec.rtl ? FONT_AR : FONT;
  // SVG anchors follow the text direction: for right-to-left text, "start" is the right edge.
  const anchor = "start";
  const x0 = spec.rtl ? W - 20 : 20;
  out.appendChild(text(x0, 40, spec.title, { "font-family": font, "font-size": 24, "font-weight": 600, fill: "#18181b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
  if (spec.subtitle) out.appendChild(text(x0, 66, spec.subtitle, { "font-family": font, "font-size": 15, fill: "#52525b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));

  const map = mapSvg.cloneNode(true) as SVGSVGElement;
  inlineStyles(mapSvg, map);
  // Clip to the map frame: a zoomed-in view must not spill over the title or legend.
  const clip = document.createElementNS(SVG_NS, "clipPath");
  clip.setAttribute("id", "sa-map-frame");
  const frame = document.createElementNS(SVG_NS, "rect");
  frame.setAttribute("width", String(w));
  frame.setAttribute("height", String(h));
  clip.appendChild(frame);
  out.appendChild(clip);
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", `translate(${mapX} ${top})`);
  g.setAttribute("clip-path", "url(#sa-map-frame)");
  for (const child of Array.from(map.childNodes)) g.appendChild(child);
  g.querySelectorAll("text").forEach((t) => t.setAttribute("font-family", spec.rtl ? FONT_AR : FONT));
  out.appendChild(g);

  if (spec.side) {
    const S = spec.side;
    const sx = spec.rtl ? 0 : w + SIDE_GAP;
    const tx = spec.rtl ? sx + SIDE_W : sx;
    const dirAttrs = { "font-family": font, "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" };
    out.appendChild(text(tx, top + 14, S.title, { ...dirAttrs, "font-size": 14, "font-weight": 600, fill: "#18181b" }));
    if (S.subtitle) out.appendChild(text(tx, top + 32, S.subtitle, { ...dirAttrs, "font-size": 11, fill: "#52525b" }));
    const chart = document.createElementNS(SVG_NS, "svg");
    chart.setAttribute("x", String(sx));
    chart.setAttribute("y", String(top + 44));
    chart.setAttribute("width", String(SIDE_W));
    drawRanking(chart, S.items, { rtl: !!spec.rtl, format: S.format, width: SIDE_W, limit: S.limit, animate: false });
    chart.querySelectorAll("rect.rank-hit, title").forEach((n) => n.remove());
    chart.querySelectorAll("[class]").forEach((n) => n.removeAttribute("class"));
    chart.removeAttribute("height");
    chart.setAttribute("height", chart.getAttribute("viewBox")!.split(" ")[3]);
    out.appendChild(chart);
  }

  if (spec.legend) {
    const ly = top + h + 12;
    const L = spec.legend;
    out.appendChild(text(spec.rtl ? mapX + w - 20 : 20, ly + 12, L.title, { "font-family": font, "font-size": 13, "font-weight": 600, fill: "#18181b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
    const lg = document.createElementNS(SVG_NS, "g");
    const size = drawBandLegend(lg, L.bands, { rtl: !!spec.rtl });
    lg.setAttribute("transform", `translate(${spec.rtl ? mapX + w - 20 - size.width : 20} ${ly + 20})`);
    out.appendChild(lg);
  }
  out.appendChild(text(x0, H - 32, spec.rtl ? CREDIT_AR : CREDIT_EN, { "font-family": font, "font-size": 11, fill: "#52525b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
  out.appendChild(text(x0, H - 14, spec.rtl ? DISCLAIMER_AR : DISCLAIMER_EN, { "font-family": font, "font-size": 11, fill: "#71717a", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
  return new XMLSerializer().serializeToString(out);
}

export function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadSvg(name: string, svg: string): void {
  download(name, new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

export async function downloadPng(name: string, svg: string, scale = 2): Promise<void> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not draw the map as an image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("Could not create the PNG");
    download(name, blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** CSV with a byte-order mark so Excel opens Arabic text correctly. */
export function toCsv(rows: (string | number | null | undefined)[][]): Blob {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
}
