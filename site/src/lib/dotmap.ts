// The brand's "dotted" Sudan on the home page: a regular grid of dots wherever it falls inside a
// state, with one Signal dot at Khartoum. The dots are worked out once by scripts/dots.mjs, and
// drawn here on a single canvas: about 1,900 dots as one element, so phones scroll smoothly.
// They fade in once, from the top down, then the canvas stays still.
import HERO from "../data/sudan-dots-hero.json";

const FADE_MS = 600;
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
// ease-out, like the CSS "ease" the SVG version used
const ease = (t: number) => 1 - (1 - t) ** 3;

export function drawDotMap(container: HTMLElement): void {
  const { width, height, r, dots } = HERO;
  const here = HERO.here as [number, number];
  const canvas = document.createElement("canvas");
  canvas.className = "dot-map";
  canvas.setAttribute("aria-hidden", "true");
  container.replaceChildren(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--graphite").trim() || "#18181b";
  const signal = css.getPropertyValue("--signal").trim() || "#0e7c66";

  let scale = 1;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = container.clientWidth || width;
    scale = (w / width) * dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * height / width) * dpr);
  };

  /** Draw every dot at `elapsed` ms into the fade-in (Infinity = finished). */
  const draw = (elapsed: number) => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = ink;
    for (let i = 0; i < dots.length; i += 3) {
      const x = dots[i], y = dots[i + 1];
      const t = Math.min(1, Math.max(0, (elapsed - (y * 1.4 + x * 0.3)) / FADE_MS));
      if (t <= 0) continue;
      ctx.globalAlpha = dots[i + 2] * ease(t);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    const t = Math.min(1, Math.max(0, (elapsed - 900) / FADE_MS));
    ctx.globalAlpha = ease(t);
    ctx.fillStyle = signal;
    ctx.beginPath();
    ctx.arc(here[0], here[1], 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  size();
  // The last dot starts fading in at about 1.4 * height + 0.3 * width ms.
  const total = 1.4 * height + 0.3 * width + FADE_MS;
  let done = reduced();
  if (done) draw(Infinity);
  else {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      draw(elapsed);
      if (elapsed < total) requestAnimationFrame(step);
      else done = true;
    };
    requestAnimationFrame(step);
  }
  // Redraw sharp at the new size when the layout changes (after the fade-in, one frame only).
  new ResizeObserver(() => {
    const before = canvas.width;
    size();
    if (canvas.width !== before && done) draw(Infinity);
  }).observe(container);
}
