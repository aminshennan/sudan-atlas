// Map exports. The SVG is a copy of what is on screen with every style written out, plus a title,
// an optional legend and the source credit, so it opens the same in any editor. The PNG is that
// SVG drawn at twice its size. Everything happens in the browser; nothing is sent anywhere.
const SVG_NS = "http://www.w3.org/2000/svg";
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const FONT_AR = "'IBM Plex Sans Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, sans-serif";
export const CREDIT_EN = "Boundaries: OCHA COD-AB Sudan v03 (CC BY 3.0 IGO). Names and P-codes: Sudan Atlas (CC BY 4.0).";
export const CREDIT_AR = "مصدر الحدود: أوتشا، مجموعة COD-AB للسودان، الإصدار الثالث (CC BY 3.0 IGO). الأسماء والرموز: أطلس السودان (CC BY 4.0).";

export interface LegendSpec {
  title: string;
  colours: string[];
  /** Values at the edges between colours: one more than the colours (lowest, breaks, highest). */
  edges: string[];
  noData?: string;
}
export interface ExportSpec {
  title: string;
  subtitle?: string;
  legend?: LegendSpec;
  rtl?: boolean;
}

const PROPS = ["fill", "stroke", "stroke-width", "stroke-linejoin", "opacity", "font-size", "font-weight", "paint-order"] as const;

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
  const legendH = spec.legend ? 64 : 0;
  const bottom = 44 + legendH;
  const W = w;
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
  const anchor = spec.rtl ? "end" : "start";
  const x0 = spec.rtl ? W - 20 : 20;
  out.appendChild(text(x0, 40, spec.title, { "font-family": font, "font-size": 24, "font-weight": 600, fill: "#18181b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
  if (spec.subtitle) out.appendChild(text(x0, 66, spec.subtitle, { "font-family": font, "font-size": 15, fill: "#52525b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));

  const map = mapSvg.cloneNode(true) as SVGSVGElement;
  inlineStyles(mapSvg, map);
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", `translate(0 ${top})`);
  for (const child of Array.from(map.childNodes)) g.appendChild(child);
  g.querySelectorAll("text").forEach((t) => t.setAttribute("font-family", spec.rtl ? FONT_AR : FONT));
  out.appendChild(g);

  if (spec.legend) {
    const ly = top + h + 12;
    const L = spec.legend;
    out.appendChild(text(x0, ly + 12, L.title, { "font-family": font, "font-size": 13, "font-weight": 600, fill: "#18181b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
    const sw = 84;
    // Colours run low to high from the reading start; each break value sits under its edge.
    const edgeX = (i: number) => (spec.rtl ? W - 20 - i * sw : 20 + i * sw);
    L.colours.forEach((c, i) => {
      const r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", String(spec.rtl ? edgeX(i + 1) : edgeX(i)));
      r.setAttribute("y", String(ly + 22));
      r.setAttribute("width", String(sw - 1));
      r.setAttribute("height", "12");
      r.setAttribute("fill", c);
      out.appendChild(r);
    });
    L.edges.forEach((label, i) => {
      const first = i === 0, last = i === L.edges.length - 1;
      const a = first ? (spec.rtl ? "end" : "start") : last ? (spec.rtl ? "start" : "end") : "middle";
      out.appendChild(text(edgeX(i), ly + 50, label, { "font-family": FONT, "font-size": 11, fill: "#52525b", "text-anchor": a }));
    });
    if (L.noData) {
      const x = spec.rtl ? W - 20 - (L.colours.length + 1) * sw - 20 : 20 + L.colours.length * sw + 20;
      const r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", String(x));
      r.setAttribute("y", String(ly + 22));
      r.setAttribute("width", "20");
      r.setAttribute("height", "12");
      r.setAttribute("fill", "#d4d4d8");
      out.appendChild(r);
      out.appendChild(text(x + 26, ly + 33, L.noData, { "font-family": font, "font-size": 11, fill: "#52525b" }));
    }
  }
  out.appendChild(text(x0, H - 16, spec.rtl ? CREDIT_AR : CREDIT_EN, { "font-family": font, "font-size": 11, fill: "#52525b", "text-anchor": anchor, direction: spec.rtl ? "rtl" : "ltr" }));
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
