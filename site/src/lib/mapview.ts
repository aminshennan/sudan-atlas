// An SVG map of Sudan's states and localities, drawn with d3-geo in an equal-area projection.
// Hover shows a tooltip and moves the coordinate bar; click selects; a state can be focused
// to show its localities. The same SVG is what the export menu saves.
import { geoConicEqualArea, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import { type AdmFeature, loadLevel, placeName } from "./atlas";
import type { Lang } from "./i18n";

export type LabelMode = "en" | "ar" | "off";
const SVG_NS = "http://www.w3.org/2000/svg";
const W = 800;
const H = 760;
const PAD = 16;

export interface MapViewOptions {
  labels?: LabelMode;
  /** Colour for each place; places without one use the neutral fill. */
  fill?: (pcode: string) => string | undefined;
  onSelect?: (pcode: string | null) => void;
  interactive?: boolean;
  title?: string;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export class MapView {
  readonly svg: SVGSVGElement;
  private projection: GeoProjection;
  private path: GeoPath;
  private baseScale = 1;
  private states: AdmFeature[] = [];
  private localities: AdmFeature[] = [];
  private level: 1 | 2 = 1;
  private focus: string | null = null;
  private selected: string | null = null;
  private labels: LabelMode;
  private tooltip: HTMLDivElement;
  private layers: Record<"fills" | "borders" | "outline" | "labels", SVGGElement>;
  /** Label size in map units, so labels stay about 11 px on screen at any width. */
  private labelSize = 12;

  constructor(private container: HTMLElement, private opts: MapViewOptions = {}) {
    this.labels = opts.labels ?? "en";
    this.projection = geoConicEqualArea().parallels([9, 21]).rotate([-30, 0]);
    this.path = geoPath(this.projection);
    this.svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "mapview__svg" });
    this.svg.setAttribute("aria-label", opts.title ?? "Map of Sudan");
    this.layers = {
      fills: this.svg.appendChild(el("g", { class: "mv-fills" })),
      borders: this.svg.appendChild(el("g", { class: "mv-borders", fill: "none", "pointer-events": "none" })),
      outline: this.svg.appendChild(el("g", { class: "mv-outline", fill: "none", "pointer-events": "none" })),
      labels: this.svg.appendChild(el("g", { class: "mv-labels", "pointer-events": "none" })),
    };
    this.tooltip = document.createElement("div");
    this.tooltip.className = "mapview__tooltip";
    this.tooltip.hidden = true;
    container.classList.add("mapview");
    container.append(this.svg, this.tooltip);
    if (opts.interactive !== false) this.bindPointer();
    new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (!width) return;
      const size = Math.min(26, Math.max(10, (11 * W) / width));
      if (Math.abs(size - this.labelSize) > 0.5) { this.labelSize = size; this.renderLabels(); }
    }).observe(this.svg);
  }

  async load(): Promise<void> {
    [this.states, this.localities] = await Promise.all([loadLevel(1), loadLevel(2)]);
    this.fit();
    this.render();
  }

  get currentLevel(): 1 | 2 { return this.level; }
  get currentFocus(): string | null { return this.focus; }

  setLevel(level: 1 | 2): void { this.level = level; this.render(); }
  setLabels(mode: LabelMode): void { this.labels = mode; this.renderLabels(); }
  setFill(fill: MapViewOptions["fill"]): void { this.opts.fill = fill; this.render(); }

  /** Zoom to one state and show its localities, or back to the whole country with null. */
  setFocus(statePcode: string | null): void {
    this.focus = statePcode;
    if (statePcode) this.level = 2;
    this.fit();
    this.render();
  }

  select(pcode: string | null): void {
    this.selected = pcode;
    this.layers.fills.querySelectorAll<SVGPathElement>("path").forEach((p) =>
      p.classList.toggle("is-selected", p.dataset.pcode === pcode));
    const chosen = this.layers.fills.querySelector<SVGPathElement>(`path[data-pcode="${pcode}"]`);
    chosen?.parentNode?.appendChild(chosen); // draw the selected outline on top
  }

  private visible(): AdmFeature[] {
    if (this.level === 1) return this.states;
    return this.focus ? this.localities.filter((f) => f.properties.parent_pcode === this.focus) : this.localities;
  }

  private fit(): void {
    const target = this.focus
      ? { type: "FeatureCollection" as const, features: this.states.filter((f) => f.properties.pcode === this.focus) }
      : { type: "FeatureCollection" as const, features: this.states };
    this.projection.fitExtent([[PAD, PAD], [W - PAD, H - PAD]], target);
    if (!this.focus) this.baseScale = this.projection.scale();
  }

  zoomLevel(): number {
    return 5 + Math.log2(this.projection.scale() / this.baseScale);
  }

  render(): void {
    const { fills, borders, outline } = this.layers;
    fills.replaceChildren();
    borders.replaceChildren();
    outline.replaceChildren();
    const lang = (document.documentElement.lang === "ar" ? "ar" : "en") as Lang;
    for (const f of this.visible()) {
      const d = this.path(f);
      if (!d) continue;
      const colour = this.opts.fill?.(f.properties.pcode);
      const p = el("path", { d, class: "mv-place" + (colour ? " has-value" : "") });
      if (colour) p.style.fill = colour;
      p.dataset.pcode = f.properties.pcode;
      p.dataset.name = placeName(f.properties, lang);
      fills.appendChild(p);
    }
    // State borders stay visible over localities, so the country always reads as states.
    const stateSet = this.focus ? this.states.filter((f) => f.properties.pcode === this.focus) : this.states;
    for (const f of stateSet) {
      const d = this.path(f);
      if (d) (this.level === 2 ? borders : outline).appendChild(el("path", { d, class: this.level === 2 ? "mv-state-border" : "mv-state-line" }));
    }
    this.select(this.selected);
    this.renderLabels();
  }

  private renderLabels(): void {
    const g = this.layers.labels;
    g.replaceChildren();
    if (this.labels === "off") return;
    // Whole country: label states. Focused on a state: label its localities. Larger places are
    // labelled first; a label that would overlap one already placed is left out.
    const features = (this.focus ? this.visible() : this.level === 1 ? this.states : [])
      .map((f) => ({ f, area: this.path.area(f), c: this.path.centroid(f) }))
      .filter((x) => Number.isFinite(x.c[0]))
      .sort((a, b) => b.area - a.area);
    const size = this.labelSize;
    const placed: [number, number, number, number][] = [];
    for (const { f, c } of features) {
      const label = this.labels === "ar" ? f.properties.name_ar : f.properties.name_en;
      const w = label.length * size * (this.labels === "ar" ? 0.5 : 0.56) + 4;
      const h = size * 1.3;
      const cx = Math.min(W - 4 - w / 2, Math.max(4 + w / 2, c[0])); // keep the label inside the map
      const box: [number, number, number, number] = [cx - w / 2, c[1] - h / 2, cx + w / 2, c[1] + h / 2];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      const text = el("text", { x: cx.toFixed(1), y: c[1].toFixed(1), class: "mv-label", "text-anchor": "middle", "dominant-baseline": "middle", "font-size": size.toFixed(1) });
      text.style.strokeWidth = `${(size / 4).toFixed(1)}px`;
      text.textContent = label;
      if (this.labels === "ar") text.setAttribute("direction", "rtl");
      g.appendChild(text);
    }
  }

  private bindPointer(): void {
    const hud = { lat: document.querySelector("[data-hud=lat]"), lon: document.querySelector("[data-hud=lon]"), zoom: document.querySelector("[data-hud=zoom]") };
    const toSvg = (e: PointerEvent): [number, number] => {
      const r = this.svg.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    };
    this.svg.addEventListener("pointermove", (e) => {
      const ll = this.projection.invert?.(toSvg(e));
      if (ll && hud.lat && hud.lon) {
        hud.lat.textContent = `${Math.abs(ll[1]).toFixed(4)}° ${ll[1] >= 0 ? "N" : "S"}`;
        hud.lon.textContent = `${Math.abs(ll[0]).toFixed(4)}° ${ll[0] >= 0 ? "E" : "W"}`;
      }
      if (hud.zoom) hud.zoom.textContent = this.zoomLevel().toFixed(1);
      const target = e.target as SVGElement;
      const pcode = target.dataset?.pcode;
      this.layers.fills.querySelectorAll(".is-hover").forEach((n) => n.classList.remove("is-hover"));
      if (!pcode) { this.tooltip.hidden = true; return; }
      target.classList.add("is-hover");
      const lang = document.documentElement.lang === "ar" ? "ar" : "en";
      const f = this.visible().find((x) => x.properties.pcode === pcode);
      if (!f) return;
      const other = lang === "ar" ? f.properties.name_en : f.properties.name_ar;
      this.tooltip.innerHTML = "";
      const main = document.createElement("strong");
      main.textContent = placeName(f.properties, lang);
      const sub = document.createElement("span");
      sub.textContent = other;
      sub.lang = lang === "ar" ? "en" : "ar";
      const code = document.createElement("code");
      code.textContent = pcode;
      this.tooltip.append(main, sub, code);
      const box = this.container.getBoundingClientRect();
      this.tooltip.style.left = `${e.clientX - box.left + 14}px`;
      this.tooltip.style.top = `${e.clientY - box.top + 14}px`;
      this.tooltip.hidden = false;
    });
    this.svg.addEventListener("pointerleave", () => {
      this.tooltip.hidden = true;
      this.layers.fills.querySelectorAll(".is-hover").forEach((n) => n.classList.remove("is-hover"));
    });
    this.svg.addEventListener("click", (e) => {
      const pcode = (e.target as SVGElement).dataset?.pcode ?? null;
      this.select(pcode);
      this.opts.onSelect?.(pcode);
    });
  }

  feature(pcode: string): AdmFeature | undefined {
    return [...this.states, ...this.localities].find((f) => f.properties.pcode === pcode);
  }
}
