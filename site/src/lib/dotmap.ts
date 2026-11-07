// The brand's "dotted" Sudan: a regular grid of dots kept wherever it falls inside a state,
// computed from the real boundaries, with one Signal dot at Khartoum.
import { geoConicEqualArea, geoPath } from "d3-geo";
import { loadLevel } from "./atlas";

const SVG_NS = "http://www.w3.org/2000/svg";
const KHARTOUM: [number, number] = [32.5599, 15.5007];

export async function drawDotMap(container: HTMLElement, { width = 640, height = 600, step = 11 } = {}): Promise<void> {
  const states = await loadLevel(1, "light");
  const projection = geoConicEqualArea().parallels([9, 21]).rotate([-30, 0])
    .fitExtent([[8, 8], [width - 8, height - 8]], { type: "FeatureCollection", features: states });
  const path = geoPath(projection);
  const shapes = states.map((f) => new Path2D(path(f) ?? ""));
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "dot-map");
  svg.setAttribute("aria-hidden", "true");
  const frag = document.createDocumentFragment();
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      if (!shapes.some((s) => ctx.isPointInPath(s, x, y))) continue;
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", "2.1");
      // a slow wash of tone across the country, like the depth shading of the brand mark
      const tone = 0.32 + 0.5 * (0.5 + 0.5 * Math.sin(x / 90 + y / 140));
      c.style.setProperty("--o", tone.toFixed(2));
      c.style.setProperty("--d", `${Math.round(y * 1.4 + x * 0.3)}ms`);
      frag.appendChild(c);
    }
  }
  const here = projection(KHARTOUM);
  if (here) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", here[0].toFixed(1));
    c.setAttribute("cy", here[1].toFixed(1));
    c.setAttribute("r", "7");
    c.setAttribute("class", "dot-map__here");
    c.style.setProperty("--o", "1");
    c.style.setProperty("--d", "900ms");
    frag.appendChild(c);
  }
  svg.appendChild(frag);
  container.replaceChildren(svg);
}
