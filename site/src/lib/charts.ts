// D3 charts for the map-maker: a ranked bar chart of places by value, and a legend that shows
// how many places fall in each colour band. Both are drawn with plain SVG attributes (no page
// CSS), so the chart on screen and the one written into an exported image are identical.
import { max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import "d3-transition";

// Text with direction="rtl" uses text-anchor="start" to align right: SVG anchors follow the
// text direction.
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const FONT_AR = "'IBM Plex Sans Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, sans-serif";
const INK = "#18181b";
const MUTED = "#52525b";
const EDGE = "rgba(24,24,27,0.18)";
const ROW = 22;

export interface RankItem {
  pcode: string;
  name: string;
  value: number;
  colour: string;
}

export interface RankingOptions {
  rtl: boolean;
  format: (v: number) => string;
  width?: number;
  /** Show only the first n rows (used for exports). */
  limit?: number;
  animate?: boolean;
  onHover?: (pcode: string | null) => void;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Draw places as horizontal bars, largest first, into an SVG (replacing what was there). */
export function drawRanking(svgEl: SVGSVGElement, items: RankItem[], o: RankingOptions): void {
  const width = o.width ?? 320;
  const rows = [...items].sort((a, b) => b.value - a.value).slice(0, o.limit ?? items.length);
  const height = rows.length * ROW + 4;
  const nameW = Math.round(width * 0.4);
  const valueW = 52;
  const barMax = width - nameW - valueW - 8;
  const x = scaleLinear().domain([0, max(rows, (d) => d.value) || 1]).range([0, barMax]);
  const font = o.rtl ? FONT_AR : FONT;
  // Reading direction: names at the start, bars growing towards the end.
  const nameX = o.rtl ? width : 0;
  const barStart = o.rtl ? width - nameW - 4 : nameW + 4;
  const barX = (d: RankItem) => (o.rtl ? barStart - x(Math.max(0, d.value)) : barStart);
  const valueX = (d: RankItem) => (o.rtl ? barStart - x(Math.max(0, d.value)) - 6 : barStart + x(Math.max(0, d.value)) + 6);
  const duration = o.animate === false || reducedMotion() ? 0 : 450;

  const svg = select(svgEl).attr("viewBox", `0 0 ${width} ${height}`).attr("height", height).attr("direction", "ltr");
  const row = svg.selectAll<SVGGElement, RankItem>("g.rank-row")
    .data(rows, (d) => d.pcode)
    .join((enter) => {
      const g = enter.append("g").attr("class", "rank-row").attr("transform", (_, i) => `translate(0 ${i * ROW})`);
      g.append("rect").attr("class", "rank-hit").attr("width", width).attr("height", ROW).attr("fill", "transparent");
      g.append("rect").attr("class", "rank-bar").attr("y", 4).attr("height", ROW - 8).attr("x", barStart).attr("width", 0).attr("stroke", EDGE).attr("stroke-width", 0.75);
      g.append("text").attr("class", "rank-name").attr("y", ROW / 2).attr("dominant-baseline", "middle").attr("font-size", 12).attr("fill", INK);
      g.append("text").attr("class", "rank-value").attr("y", ROW / 2).attr("dominant-baseline", "middle").attr("font-size", 11).attr("fill", MUTED)
        .attr("font-family", FONT).attr("font-variant-numeric", "tabular-nums");
      return g;
    });
  row.attr("data-pcode", (d) => d.pcode);
  const rowY = (_: RankItem, i: number) => `translate(0 ${i * ROW})`;
  const bar = row.select<SVGRectElement>("rect.rank-bar").attr("fill", (d) => d.colour);
  const value = row.select<SVGTextElement>("text.rank-value").attr("text-anchor", o.rtl ? "end" : "start").text((d) => o.format(d.value));
  row.select<SVGTextElement>("text.rank-name")
    .attr("x", nameX).attr("text-anchor", "start").attr("direction", o.rtl ? "rtl" : "ltr").attr("font-family", font)
    .text((d) => truncate(d.name, nameW, o.rtl));
  // Transitions apply on a later frame even at zero duration, so set the final positions
  // directly when not animating (exports serialise the chart straight away).
  if (duration) {
    row.transition().duration(duration).attr("transform", rowY);
    bar.transition().duration(duration).attr("x", barX).attr("width", (d) => x(Math.max(0, d.value)));
    value.transition().duration(duration).attr("x", valueX);
  } else {
    row.attr("transform", rowY);
    bar.attr("x", barX).attr("width", (d) => x(Math.max(0, d.value)));
    value.attr("x", valueX);
  }
  row.selectAll<SVGTitleElement, RankItem>("title").data((d) => [d]).join("title").text((d) => `${d.name}: ${o.format(d.value)}`);

  if (o.onHover) {
    row.on("pointerenter", (_, d) => o.onHover!(d.pcode)).on("pointerleave", () => o.onHover!(null));
  }
}

/** Mark one row (for example the place under the pointer on the map). */
export function highlightRanking(svgEl: SVGSVGElement, pcode: string | null): void {
  select(svgEl).selectAll<SVGGElement, RankItem>("g.rank-row")
    .each(function (d) {
      const on = d.pcode === pcode;
      select(this).select("rect.rank-hit").attr("fill", on ? "rgba(24,24,27,0.06)" : "transparent");
      select(this).select("rect.rank-bar").attr("stroke", on ? INK : EDGE).attr("stroke-width", on ? 1.5 : 0.75);
      select(this).select("text.rank-name").attr("font-weight", on ? 600 : null);
    });
}

function truncate(text: string, width: number, rtl: boolean): string {
  const fits = Math.floor(width / (rtl ? 6 : 6.6));
  return text.length > fits ? `${text.slice(0, fits - 1)}…` : text;
}

export interface BandLegend {
  colours: string[];
  /** Formatted values at the edges between colours: one more than the colours. */
  edges: string[];
  /** How many places fall in each colour. */
  counts: number[];
  noDataLabel: string;
  noDataCount: number;
  caption: string;
}

/** The colour scale with a small bar over each colour showing how many places it holds. */
export function drawBandLegend(target: SVGSVGElement | SVGGElement, L: BandLegend, o: { rtl: boolean; swatch?: number }): { width: number; height: number } {
  const sw = o.swatch ?? 72;
  const n = L.colours.length;
  const barH = 34;
  const top = 30;
  const swatchY = top + barH + 4;
  const noDataW = 150;
  const width = n * sw + 24 + noDataW;
  const height = swatchY + 12 + 34;
  const font = o.rtl ? FONT_AR : FONT;
  const y = scaleLinear().domain([0, max(L.counts) || 1]).range([0, barH]);
  // Low to high from the reading start.
  const left = (i: number) => (o.rtl ? width - (i + 1) * sw : i * sw);
  const edgeX = (i: number) => (o.rtl ? width - i * sw : i * sw);

  // Numbers read left to right; the page around may be right-to-left, so say so explicitly.
  const g = select(target as SVGGElement).attr("direction", "ltr");
  g.selectAll("*").remove();
  if (target instanceof SVGSVGElement) g.attr("viewBox", `0 0 ${width} ${height}`);

  L.colours.forEach((c, i) => {
    const h = Math.max(L.counts[i] ? 2 : 0, y(L.counts[i]));
    g.append("rect").attr("x", left(i) + 10).attr("y", top + barH - h).attr("width", sw - 20).attr("height", h).attr("fill", c).attr("stroke", EDGE).attr("stroke-width", 0.75);
    g.append("text").attr("x", left(i) + sw / 2).attr("y", top + barH - h - 4).attr("text-anchor", "middle").attr("font-size", 11).attr("font-family", FONT).attr("fill", MUTED).text(L.counts[i]);
    g.append("rect").attr("x", left(i)).attr("y", swatchY).attr("width", sw - 1).attr("height", 12).attr("fill", c).attr("stroke", EDGE).attr("stroke-width", 0.5);
  });
  L.edges.forEach((label, i) => {
    const first = i === 0, last = i === L.edges.length - 1;
    const anchor = first ? (o.rtl ? "end" : "start") : last ? (o.rtl ? "start" : "end") : "middle";
    g.append("text").attr("x", edgeX(i)).attr("y", swatchY + 28).attr("text-anchor", anchor).attr("font-size", 11).attr("font-family", FONT).attr("fill", MUTED).text(label);
  });
  // No data: a grey swatch with its count, after the scale.
  const ndX = o.rtl ? width - n * sw - 24 - 14 : n * sw + 24;
  g.append("rect").attr("x", ndX).attr("y", swatchY).attr("width", 14).attr("height", 12).attr("fill", "#d4d4d8");
  g.append("text").attr("x", o.rtl ? ndX - 6 : ndX + 20).attr("y", swatchY + 10).attr("text-anchor", "start")
    .attr("direction", o.rtl ? "rtl" : "ltr").attr("font-size", 11).attr("font-family", font).attr("fill", MUTED).text(`${L.noDataLabel} (${L.noDataCount})`);
  g.append("text").attr("x", o.rtl ? width : 0).attr("y", 9).attr("text-anchor", "start").attr("direction", o.rtl ? "rtl" : "ltr")
    .attr("font-size", 11).attr("font-family", font).attr("fill", MUTED).text(L.caption);
  return { width, height };
}
