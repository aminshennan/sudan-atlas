// An SVG map of Sudan's states and localities, drawn with d3-geo in an equal-area projection.
// Hover shows a tooltip and moves the coordinate bar; click selects; a state can be focused
// to show its localities. With zoom on, d3-zoom adds wheel, pinch and drag, zoom buttons, and an
// animated flight into and out of a focused state. The same SVG is what the export menu saves,
// so an export shows exactly the view on screen.
import { geoConicEqualArea, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import { select as d3select, type Selection } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { type AdmFeature, loadLevel, placeName } from "./atlas";
import { t, type Lang } from "./i18n";

export type LabelMode = "en" | "ar" | "off";
const SVG_NS = "http://www.w3.org/2000/svg";
const W = 800;
const H = 760;
const PAD = 16;
const MAX_ZOOM = 64;
/** Below this zoom, localities across the whole country are too small to label. */
const LOCALITY_LABEL_ZOOM = 2.5;

export interface MapViewOptions {
  labels?: LabelMode;
  /** Colour for each place; places without one use the neutral fill. */
  fill?: (pcode: string) => string | undefined;
  onSelect?: (pcode: string | null) => void;
  /** Called when the pointer moves onto a place, or off the map (null). */
  onHover?: (pcode: string | null) => void;
  interactive?: boolean;
  /** Wheel, pinch and drag zoom with zoom buttons. Off by default (the home page scrolls past its map). */
  zoom?: boolean;
  title?: string;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** a after b: the zoom that does b, then a. */
function compose(a: ZoomTransform, b: ZoomTransform): ZoomTransform {
  return zoomIdentity.translate(a.x + a.k * b.x, a.y + a.k * b.y).scale(a.k * b.k);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class MapView {
  readonly svg: SVGSVGElement;
  private projection: GeoProjection;
  private path: GeoPath;
  private baseScale = 1;
  private states: AdmFeature[] = [];
  private localities: AdmFeature[] = [];
  private level: 1 | 2 = 1;
  /** The focus asked for. */
  private focus: string | null = null;
  /** The focus the projection is fitted to; differs from `focus` only while flying between them. */
  private drawnFocus: string | null = null;
  private selected: string | null = null;
  private hovered: string | null = null;
  private labels: LabelMode;
  private tooltip: HTMLDivElement;
  private zoomGroup: SVGGElement;
  private layers: Record<"fills" | "borders" | "outline" | "labels", SVGGElement>;
  /** Label size in map units at zoom 1, so labels stay about 11 px on screen at any width. */
  private labelSize = 12;
  private transform: ZoomTransform = zoomIdentity;
  private zoomer?: ZoomBehavior<SVGSVGElement, unknown>;
  private zoomSel?: Selection<SVGSVGElement, unknown, null, undefined>;
  private flight = 0;
  private labelFrame = 0;
  private loaded = false;

  constructor(private container: HTMLElement, private opts: MapViewOptions = {}) {
    this.labels = opts.labels ?? "en";
    this.projection = geoConicEqualArea().parallels([9, 21]).rotate([-30, 0]);
    this.path = geoPath(this.projection);
    this.svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "mapview__svg" });
    this.svg.setAttribute("aria-label", opts.title ?? "Map of Sudan");
    this.zoomGroup = this.svg.appendChild(el("g", { class: "mv-zoom" }));
    this.layers = {
      fills: this.zoomGroup.appendChild(el("g", { class: "mv-fills" })),
      borders: this.zoomGroup.appendChild(el("g", { class: "mv-borders", fill: "none", "pointer-events": "none" })),
      outline: this.zoomGroup.appendChild(el("g", { class: "mv-outline", fill: "none", "pointer-events": "none" })),
      labels: this.zoomGroup.appendChild(el("g", { class: "mv-labels", "pointer-events": "none" })),
    };
    this.tooltip = document.createElement("div");
    this.tooltip.className = "mapview__tooltip";
    this.tooltip.hidden = true;
    container.classList.add("mapview");
    container.append(this.svg, this.tooltip);
    if (opts.interactive !== false) this.bindPointer();
    if (opts.zoom) { container.classList.add("has-zoom"); this.bindZoom(); }
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
    this.loaded = true;
  }

  get currentLevel(): 1 | 2 { return this.level; }
  get currentFocus(): string | null { return this.focus; }

  setLevel(level: 1 | 2): void { this.level = level; this.render(); }
  setLabels(mode: LabelMode): void { this.labels = mode; this.renderLabels(); }
  setFill(fill: MapViewOptions["fill"]): void { this.opts.fill = fill; this.render(); }

  /**
   * Show one state's localities, or the whole country with null. With zoom on, the map flies
   * there: it zooms the current drawing to the state's outline, then redraws fitted to the state,
   * which lines up exactly, so the switch can't be seen.
   */
  setFocus(statePcode: string | null): void {
    const from = this.drawnFocus;
    this.focus = statePcode;
    if (statePcode) this.level = 2;
    const animate = this.zoomer && this.loaded && !reducedMotion();
    if (from === statePcode && this.loaded) {
      this.render();
      if (this.transform.k !== 1) this.applyTransform(zoomIdentity, true);
      return;
    }
    const flight = ++this.flight;
    if (!animate) {
      this.drawnFocus = statePcode;
      this.fit();
      this.render();
      this.applyTransform(zoomIdentity, false);
      return;
    }
    // Express where we are now in whole-country coordinates, then draw the whole country there.
    const start = compose(this.transform, this.focusTransform(from));
    this.drawnFocus = null;
    this.fit();
    this.render();
    this.applyTransform(start, false);
    const target = this.focusTransform(statePcode);
    this.applyTransform(target, true, () => {
      if (flight !== this.flight) return;
      this.drawnFocus = statePcode;
      this.fit();
      this.render();
      this.applyTransform(zoomIdentity, false);
    });
  }

  /** Zoom in or out around the centre of the map. */
  zoomBy(factor: number): void {
    if (this.zoomSel && this.zoomer) this.zoomSel.transition().duration(reducedMotion() ? 0 : 250).call(this.zoomer.scaleBy, factor);
  }

  /** Back to the whole of the current view (the country, or the focused state). */
  resetZoom(): void { this.applyTransform(zoomIdentity, true); }

  select(pcode: string | null): void {
    this.selected = pcode;
    this.layers.fills.querySelectorAll<SVGPathElement>("path").forEach((p) =>
      p.classList.toggle("is-selected", p.dataset.pcode === pcode));
    const chosen = this.layers.fills.querySelector<SVGPathElement>(`path[data-pcode="${pcode}"]`);
    chosen?.parentNode?.appendChild(chosen); // draw the selected outline on top
  }

  /** Outline a place, for example while its bar in a chart is hovered. */
  highlight(pcode: string | null): void {
    this.hovered = pcode;
    this.layers.fills.querySelectorAll<SVGPathElement>("path.is-linked").forEach((p) => p.classList.remove("is-linked"));
    if (!pcode) return;
    const p = this.layers.fills.querySelector<SVGPathElement>(`path[data-pcode="${pcode}"]`);
    if (p) { p.classList.add("is-linked"); p.parentNode?.appendChild(p); }
  }

  private visible(): AdmFeature[] {
    if (this.level === 1) return this.states;
    return this.drawnFocus ? this.localities.filter((f) => f.properties.parent_pcode === this.drawnFocus) : this.localities;
  }

  private fit(): void {
    const target = this.drawnFocus
      ? { type: "FeatureCollection" as const, features: this.states.filter((f) => f.properties.pcode === this.drawnFocus) }
      : { type: "FeatureCollection" as const, features: this.states };
    this.projection.fitExtent([[PAD, PAD], [W - PAD, H - PAD]], target);
    if (!this.drawnFocus) this.baseScale = this.projection.scale();
  }

  /**
   * The zoom that shows a state the way fitExtent would, measured in whole-country coordinates.
   * Projections differ only by scale and offset, so this matches the fitted drawing exactly.
   */
  private focusTransform(statePcode: string | null): ZoomTransform {
    if (!statePcode) return zoomIdentity;
    const f = this.states.find((s) => s.properties.pcode === statePcode);
    if (!f) return zoomIdentity;
    const saved = this.drawnFocus;
    if (saved) { this.drawnFocus = null; this.fit(); }
    const [[x0, y0], [x1, y1]] = this.path.bounds(f);
    if (saved) { this.drawnFocus = saved; this.fit(); }
    const k = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0));
    return zoomIdentity.translate(W / 2 - (k * (x0 + x1)) / 2, H / 2 - (k * (y0 + y1)) / 2).scale(k);
  }

  zoomLevel(): number {
    return 5 + Math.log2(this.projection.scale() / this.baseScale) + Math.log2(this.transform.k);
  }

  render(): void {
    const { fills, borders, outline } = this.layers;
    fills.replaceChildren();
    borders.replaceChildren();
    outline.replaceChildren();
    const lang = (document.documentElement.lang === "ar" ? "ar" : "en") as Lang;
    this.svg.setAttribute("aria-label", lang === "ar" ? "خريطة السودان" : this.opts.title ?? "Map of Sudan");
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
    const stateSet = this.drawnFocus ? this.states.filter((f) => f.properties.pcode === this.drawnFocus) : this.states;
    for (const f of stateSet) {
      const d = this.path(f);
      if (d) (this.level === 2 ? borders : outline).appendChild(el("path", { d, class: this.level === 2 ? "mv-state-border" : "mv-state-line" }));
    }
    this.select(this.selected);
    this.highlight(this.hovered);
    this.renderLabels();
  }

  private renderLabels(): void {
    const g = this.layers.labels;
    g.replaceChildren();
    if (this.labels === "off") return;
    const { k, x: tx, y: ty } = this.transform;
    // Whole country: label states, and localities once zoomed in far enough. Focused on a state:
    // label its localities. Larger places are labelled first; a label that would overlap one
    // already placed is left out. Sizes are divided by the zoom so text stays the same on screen.
    const features = this.drawnFocus ? this.visible()
      : this.level === 1 ? this.states
      : k >= LOCALITY_LABEL_ZOOM ? this.localities : [];
    // The part of the map in view, in map units.
    const view = { x0: -tx / k, y0: -ty / k, x1: (W - tx) / k, y1: (H - ty) / k };
    const items = features
      .map((f) => ({ f, area: this.path.area(f), c: this.path.centroid(f) }))
      .filter((x) => Number.isFinite(x.c[0]) && x.c[0] > view.x0 && x.c[0] < view.x1 && x.c[1] > view.y0 && x.c[1] < view.y1)
      .sort((a, b) => b.area - a.area);
    const size = this.labelSize / k;
    const pad = 4 / k;
    const placed: [number, number, number, number][] = [];
    for (const { f, c } of items) {
      const label = this.labels === "ar" ? f.properties.name_ar : f.properties.name_en;
      const w = label.length * size * (this.labels === "ar" ? 0.5 : 0.56) + pad;
      const h = size * 1.3;
      const cx = Math.min(view.x1 - pad - w / 2, Math.max(view.x0 + pad + w / 2, c[0])); // keep the label in view
      const box: [number, number, number, number] = [cx - w / 2, c[1] - h / 2, cx + w / 2, c[1] + h / 2];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      const text = el("text", { x: cx.toFixed(2), y: c[1].toFixed(2), class: "mv-label", "text-anchor": "middle", "dominant-baseline": "middle", "font-size": size.toFixed(2) });
      text.style.strokeWidth = `${(size / 4).toFixed(2)}px`;
      text.textContent = label;
      if (this.labels === "ar") text.setAttribute("direction", "rtl");
      g.appendChild(text);
    }
  }

  private applyTransform(target: ZoomTransform, animate: boolean, done?: () => void): void {
    if (!this.zoomSel || !this.zoomer) {
      this.onZoom(target);
      done?.();
      return;
    }
    if (animate && !reducedMotion()) {
      const tr = this.zoomSel.transition().duration(650).call(this.zoomer.transform, target);
      if (done) tr.on("end", done);
    } else {
      this.zoomSel.interrupt().call(this.zoomer.transform, target);
      done?.();
    }
  }

  private onZoom(transform: ZoomTransform): void {
    this.transform = transform;
    this.zoomGroup.setAttribute("transform", transform.toString());
    this.svg.style.setProperty("--mv-k", String(transform.k));
    const hudZoom = document.querySelector("[data-hud=zoom]");
    if (hudZoom && this.loaded) hudZoom.textContent = this.zoomLevel().toFixed(1);
    this.container.classList.toggle("is-zoomed", transform.k > 1.01);
    cancelAnimationFrame(this.labelFrame);
    this.labelFrame = requestAnimationFrame(() => this.renderLabels());
  }

  private bindZoom(): void {
    this.zoomer = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([[0, 0], [W, H]])
      .extent([[0, 0], [W, H]])
      .on("start", (e) => { if (e.sourceEvent?.type === "mousedown") this.container.classList.add("is-panning"); this.tooltip.hidden = true; })
      .on("zoom", (e) => this.onZoom(e.transform))
      .on("end", () => this.container.classList.remove("is-panning"));
    this.zoomSel = d3select(this.svg);
    this.zoomSel.call(this.zoomer).on("dblclick.zoom", null);

    const controls = document.createElement("div");
    controls.className = "mapview__zoom";
    const button = (key: string, english: string, icon: string, action: () => void) => {
      const b = Object.assign(document.createElement("button"), { type: "button", innerHTML: icon });
      b.dataset.zoomKey = key;
      b.dataset.zoomEn = english;
      b.addEventListener("click", action);
      controls.append(b);
      return b;
    };
    const svgIcon = (d: string) => `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    button("map.zoomIn", "Zoom in", svgIcon("M10 4v12M4 10h12"), () => this.zoomBy(2));
    button("map.zoomOut", "Zoom out", svgIcon("M4 10h12"), () => this.zoomBy(0.5));
    button("map.zoomReset", "Show the whole map", svgIcon("M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"), () => this.resetZoom());
    const label = () => controls.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      const text = t(b.dataset.zoomKey!, b.dataset.zoomEn!);
      b.setAttribute("aria-label", text);
      b.title = text;
    });
    label();
    document.addEventListener("sa:lang", label);
    controls.setAttribute("role", "group");
    this.container.append(controls);

    // Keyboard: + and - zoom, 0 resets, when the map or its buttons have focus.
    this.svg.tabIndex = 0;
    this.container.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).closest("input, select, textarea")) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); this.zoomBy(2); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); this.zoomBy(0.5); }
      else if (e.key === "0") { e.preventDefault(); this.resetZoom(); }
    });
  }

  private bindPointer(): void {
    const hud = { lat: document.querySelector("[data-hud=lat]"), lon: document.querySelector("[data-hud=lon]"), zoom: document.querySelector("[data-hud=zoom]") };
    const toMap = (e: PointerEvent): [number, number] => {
      const r = this.svg.getBoundingClientRect();
      return this.transform.invert([((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]);
    };
    let lastHover: string | null = null;
    const hover = (pcode: string | null) => {
      if (pcode === lastHover) return;
      lastHover = pcode;
      this.opts.onHover?.(pcode);
    };
    this.svg.addEventListener("pointermove", (e) => {
      const ll = this.projection.invert?.(toMap(e));
      if (ll && hud.lat && hud.lon) {
        hud.lat.textContent = `${Math.abs(ll[1]).toFixed(4)}° ${ll[1] >= 0 ? "N" : "S"}`;
        hud.lon.textContent = `${Math.abs(ll[0]).toFixed(4)}° ${ll[0] >= 0 ? "E" : "W"}`;
      }
      if (hud.zoom) hud.zoom.textContent = this.zoomLevel().toFixed(1);
      const target = e.target as SVGElement;
      const pcode = target.dataset?.pcode;
      this.layers.fills.querySelectorAll(".is-hover").forEach((n) => n.classList.remove("is-hover"));
      if (!pcode || this.container.classList.contains("is-panning")) { this.tooltip.hidden = true; hover(null); return; }
      target.classList.add("is-hover");
      hover(pcode);
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
      hover(null);
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
