// Thinking orbs (Jakub Antalik, MIT) drawn with the library's framework-free engine.
// States used here: "searching" (finding places, loading the map), "connecting" (matching
// names) and "working" (building exports). Sizes 64 and 20 are the library's tuned presets.
import { MODE_DRAWS, resolvePreset } from "thinking-orbs/engine";

type OrbState = "searching" | "connecting" | "working";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function mountOrb(canvas: HTMLCanvasElement, state: OrbState, size: 20 | 64, dark = false): () => void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.classList.add("orb");
  if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const { mode, speed, opts } = resolvePreset(state, size);
  const draw = MODE_DRAWS[mode];
  const frame = (t: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    draw(ctx, size, t, dark, opts);
  };
  if (reduced()) {
    frame(0.6);
    return () => {};
  }
  let raf = 0;
  let visible = true;
  const loop = () => {
    frame((performance.now() / 1000) * speed);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (!raf && visible && document.visibilityState !== "hidden") raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(canvas);
  const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  frame((performance.now() / 1000) * speed);
  start();
  return () => {
    stop();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Mount every <canvas data-orb="state" data-orb-size="20|64" [data-orb-dark]> on the page. */
export function mountOrbs(root: ParentNode = document): void {
  root.querySelectorAll<HTMLCanvasElement>("canvas[data-orb]").forEach((canvas) => {
    if (canvas.dataset.orbMounted) return;
    canvas.dataset.orbMounted = "1";
    const size = canvas.dataset.orbSize === "20" ? 20 : 64;
    mountOrb(canvas, canvas.dataset.orb as OrbState, size, canvas.dataset.orbDark !== undefined);
  });
}
