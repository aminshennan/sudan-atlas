import { startPage } from "../main";
import { t } from "../lib/i18n";
import "../styles/docs.css";

startPage("docs");

// Python / JavaScript tabs: one choice for every example, remembered between visits.
type CodeLang = "py" | "js";
const KEY = "sa-code-lang";
function show(langChoice: CodeLang): void {
  document.querySelectorAll<HTMLElement>(".code[data-lang]").forEach((el) => (el.hidden = el.dataset.lang !== langChoice));
  document.querySelectorAll<HTMLButtonElement>("[data-code-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.codeLang === langChoice)));
  try { localStorage.setItem(KEY, langChoice); } catch { /* storage unavailable: the choice lasts for this page */ }
}
let saved: CodeLang = "py";
try { if (localStorage.getItem(KEY) === "js") saved = "js"; } catch { /* default to Python */ }
show(saved);
document.querySelectorAll<HTMLButtonElement>("[data-code-lang]").forEach((b) => b.addEventListener("click", () => show(b.dataset.codeLang as CodeLang)));

// A copy button on every code block. Code that scrolls sideways must be reachable by keyboard.
document.querySelectorAll<HTMLElement>(".code").forEach((block) => {
  const pre = block.querySelector("pre");
  if (pre) pre.tabIndex = 0;
  const button = Object.assign(document.createElement("button"), { type: "button", className: "code__copy", textContent: t("copy", "Copy") });
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(block.querySelector("code")?.textContent ?? "");
      button.textContent = t("copied", "Copied");
      setTimeout(() => (button.textContent = t("copy", "Copy")), 1500);
    } catch { /* clipboard blocked: the code can still be selected by hand */ }
  });
  block.append(button);
});
document.addEventListener("sa:lang", () => {
  document.querySelectorAll<HTMLButtonElement>(".code__copy").forEach((b) => (b.textContent = t("copy", "Copy")));
});

// Highlight the section being read in the side menu.
const links = new Map([...document.querySelectorAll<HTMLAnchorElement>(".docs__nav a")].map((a) => [a.hash.slice(1), a]));
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) {
    links.forEach((a) => a.removeAttribute("aria-current"));
    links.get(e.target.id)?.setAttribute("aria-current", "true");
  }
}, { rootMargin: "-20% 0px -70% 0px" });
document.querySelectorAll("section[id]").forEach((s) => observer.observe(s));
