// The dotted Sudan: a regular grid of dots kept wherever it falls inside the country, from the real
// state boundaries, with one Signal dot at Khartoum. Writes the brand files (public/logo.svg,
// public/favicon.svg, ../docs/logo.svg) and the dot sets the loading animation draws
// (src/data/sudan-dots.json). Run by hand when the boundaries change: node scripts/dots.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoArea, geoConicEqualArea, geoContains } from "d3-geo";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const states = JSON.parse(readFileSync(join(site, "..", "data", "boundaries", "light", "adm1.geojson"), "utf8"));
// d3 reads rings the other way round from GeoJSON: a shape covering more than half the globe is
// one whose rings run the wrong way, so reverse them (as the site does when it loads the maps).
for (const f of states.features) {
  if (geoArea(f) > 2 * Math.PI) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach((poly) => poly.forEach((ring) => ring.reverse()));
  }
}
const KHARTOUM = [32.5599, 15.5007];
const GRAPHITE = "#18181B";
const SIGNAL = "#0E7C66";

/** Dots on a square of side 1: cols across, each with a tone (0..1) for the shading wash. */
function dots(cols) {
  const projection = geoConicEqualArea().parallels([9, 21]).rotate([-30, 0]).fitExtent([[0.02, 0.02], [0.98, 0.98]], states);
  const step = 1 / cols;
  const out = [];
  for (let y = step / 2; y < 1; y += step) {
    for (let x = step / 2; x < 1; x += step) {
      const ll = projection.invert([x, y]);
      if (!ll || !states.features.some((f) => geoContains(f, ll))) continue;
      // The same slow wash of tone as the home page map: darker towards the north-west and south-east.
      const tone = 0.5 + 0.5 * Math.sin(x * 7 + y * 4.6);
      out.push([+x.toFixed(4), +y.toFixed(4), +tone.toFixed(2)]);
    }
  }
  const here = projection(KHARTOUM).map((v) => +v.toFixed(4));
  return { cols, step: +step.toFixed(5), dots: out, here };
}

/** An SVG of the dotted map; small sizes drop the tonal wash so every dot stays visible. */
function svg(set, { size, dotScale, minOpacity, hereScale, title }) {
  const r = (set.step * size * dotScale) / 2;
  const circles = set.dots
    .map(([x, y, t]) => {
      const o = minOpacity >= 1 ? "" : ` opacity="${(minOpacity + (1 - minOpacity) * t).toFixed(2)}"`;
      return `<circle cx="${(x * size).toFixed(1)}" cy="${(y * size).toFixed(1)}" r="${r.toFixed(2)}"${o}/>`;
    })
    .join("");
  const [hx, hy] = set.here;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${title}"><title>${title}</title>` +
    `<g fill="${GRAPHITE}">${circles}</g>` +
    `<circle cx="${(hx * size).toFixed(1)}" cy="${(hy * size).toFixed(1)}" r="${(r * hereScale).toFixed(2)}" fill="${SIGNAL}" stroke="#fff" stroke-width="${(r * 0.6).toFixed(2)}"/></svg>\n`;
}

const logo = dots(28);
const favicon = dots(9);
writeFileSync(join(site, "public", "logo.svg"), svg(logo, { size: 512, dotScale: 0.62, minOpacity: 0.45, hereScale: 2.4, title: "Sudan Atlas" }));
writeFileSync(join(site, "..", "docs", "logo.svg"), svg(logo, { size: 512, dotScale: 0.62, minOpacity: 0.45, hereScale: 2.4, title: "Sudan Atlas" }));
writeFileSync(join(site, "public", "favicon.svg"), svg(favicon, { size: 64, dotScale: 0.72, minOpacity: 1, hereScale: 2.2, title: "Sudan Atlas" }));
// Loader dot sets: 64-px loaders and the 20-px inline loader, plus the header mark.
writeFileSync(join(site, "src", "data", "sudan-dots.json"), JSON.stringify({ large: dots(24), small: dots(9), mark: logo }) + "\n");
// The header mark: a coarser map drawn in the text colour (currentColor), written into the header.
const mark = dots(10);
{
  const size = 64, r = (mark.step * size * 0.8) / 2;
  const circles = mark.dots.map(([x, y, t]) => `<circle cx="${(x * size).toFixed(1)}" cy="${(y * size).toFixed(1)}" r="${r.toFixed(2)}" opacity="${(0.7 + 0.3 * t).toFixed(2)}"/>`).join("");
  const [hx, hy] = mark.here;
  const svgMark = `<svg class="brand__mark" viewBox="0 0 ${size} ${size}" aria-hidden="true"><g fill="currentColor">${circles}</g><circle cx="${(hx * size).toFixed(1)}" cy="${(hy * size).toFixed(1)}" r="${(r * 1.7).toFixed(2)}" fill="${SIGNAL}" stroke="#fff" stroke-width="${(r * 0.5).toFixed(2)}"/></svg>`;
  const headerPath = join(site, "partials", "header.html");
  const header = readFileSync(headerPath, "utf8");
  const next = header.replace(/<svg class="brand__mark"[^]*?<\/svg>/, svgMark);
  if (next === header && !header.includes(svgMark)) throw new Error("brand mark not found in partials/header.html");
  writeFileSync(headerPath, next);
}
console.log(`dots: logo ${logo.dots.length}, favicon ${favicon.dots.length}, mark ${mark.dots.length}`);
