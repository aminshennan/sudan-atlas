// The loading animation: the dotted Sudan of the logo, brought to life. The dots come from
// scripts/dots.mjs (the real state boundaries), with one Signal dot at Khartoum.
//   "searching" (loading a map): light sweeps round Khartoum like an orbit, with a fading trail.
//   "connecting" (matching names): rings of light pulse outward from Khartoum across the country.
// With reduced motion it shows the still map. <canvas data-loader="searching|connecting"
// data-loader-size="64|20" [data-loader-rest="seconds"]> elements are mounted by mountLoaders().
import DOTS from "../data/sudan-dots.json";

export type LoaderState = "searching" | "connecting";
interface DotSet { step: number; dots: [number, number, number][]; here: [number, number] }

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const SIGNAL = "14, 124, 102";

const FRAME_MS = 1000 / 30;

/**
 * restSeconds: for a decorative loader (not one shown while something loads), stop after this long
 * and keep the still picture until it scrolls out of view and back in.
 */
export function mountLoader(canvas: HTMLCanvasElement, state: LoaderState, size: number, dark = false, restSeconds = 0): () => void {
  const set = (size <= 32 ? DOTS.small : DOTS.large) as unknown as DotSet;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.classList.add("loader");
  if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const ink = dark ? "244, 244, 245" : "24, 24, 27";
  const r = Math.max(0.6, (set.step * size * 0.62) / 2);
  const [hx, hy] = set.here;
  // Angle round Khartoum (0..1) and distance from it (0..1 of the farthest dot), worked out once.
  const far = Math.max(...set.dots.map(([x, y]) => Math.hypot(x - hx, y - hy)));
  const polar = set.dots.map(([x, y, tone]) => ({
    x: x * size, y: y * size, tone,
    angle: (Math.atan2(y - hy, x - hx) / (2 * Math.PI) + 1) % 1,
    dist: Math.hypot(x - hx, y - hy) / far,
  }));

  const frame = (t: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    for (const d of polar) {
      let glow: number;
      if (state === "searching") {
        // How far behind the sweeping arm this dot is (0 = just passed): a bright head, fading trail.
        const behind = (t * 0.55 - d.angle + 2) % 1;
        glow = Math.exp(-behind * 5);
      } else {
        // Rings travelling outward; each dot lights as a ring passes it.
        const phase = (t * 0.7 - d.dist * 1.6 + 4) % 1;
        glow = Math.exp(-phase * 7);
      }
      const alpha = 0.14 + 0.12 * d.tone + 0.74 * glow;
      ctx.fillStyle = `rgba(${ink}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r * (0.85 + 0.3 * glow), 0, 2 * Math.PI);
      ctx.fill();
    }
    // Khartoum breathes.
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 0.8);
    ctx.fillStyle = `rgba(${SIGNAL}, ${(0.25 * (1 - pulse)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(hx * size, hy * size, r * (2.2 + 2.2 * pulse), 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = `rgb(${SIGNAL})`;
    ctx.beginPath();
    ctx.arc(hx * size, hy * size, r * 1.9, 0, 2 * Math.PI);
    ctx.fill();
  };

  if (reduced()) {
    frame(0.12);
    return () => {};
  }
  let raf = 0;
  let visible = true;
  let last = 0;
  let began = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS - 1) return;
    last = now;
    frame(now / 1000);
    if (restSeconds && now - began > restSeconds * 1000) stop();
  };
  const start = () => {
    if (!raf && visible && document.visibilityState !== "hidden") {
      began = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  // Only animate while on screen and the tab is visible.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(canvas);
  const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  frame(performance.now() / 1000);
  start();
  return () => {
    stop();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Mount every <canvas data-loader="state" data-loader-size="20|64" [data-loader-dark]> on the page. */
export function mountLoaders(root: ParentNode = document): void {
  root.querySelectorAll<HTMLCanvasElement>("canvas[data-loader]").forEach((canvas) => {
    if (canvas.dataset.loaderMounted) return;
    canvas.dataset.loaderMounted = "1";
    const size = Number(canvas.dataset.loaderSize) || 64;
    mountLoader(canvas, canvas.dataset.loader === "connecting" ? "connecting" : "searching", size, canvas.dataset.loaderDark !== undefined, Number(canvas.dataset.loaderRest) || 0);
  });
}
