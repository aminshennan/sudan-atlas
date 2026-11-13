// Analytics that count, never read. Vercel Web Analytics (no cookies) counts page views; the
// site's own counter (/api/count) counts how often each feature is used, by page, event and
// format only.
// Google Analytics loads only after the visitor agrees, and only when a measurement ID is
// configured (VITE_GA_ID at build time). Events carry a name and a format, never file
// contents, place names or values.
import { inject, track } from "@vercel/analytics";
import { lang } from "./i18n";

const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim();
const CONSENT_KEY = "sa-consent";
type Consent = "granted" | "denied";
type Gtag = (...args: unknown[]) => void;

function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function loadGoogle(): void {
  if (!GA_ID || (window as unknown as { gtag?: Gtag }).gtag) return;
  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer.push(arguments); };
  w.gtag("js", new Date());
  w.gtag("config", GA_ID, { anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.append(s);
}

function banner(): void {
  const ar = lang() === "ar";
  const box = document.createElement("div");
  box.className = "consent";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", ar ? "ملفات تعريف الارتباط" : "Cookies");
  const text = document.createElement("p");
  text.textContent = ar
    ? "هل تسمح لنا باستخدام Google Analytics لإحصاء الزيارات؟ لن يُرسل أي شيء من ملفاتك أبدًا."
    : "May we use Google Analytics to count visits? Nothing from your files is ever sent.";
  const yes = Object.assign(document.createElement("button"), { type: "button", className: "btn btn--primary btn--small", textContent: ar ? "أسمح" : "Allow" });
  const no = Object.assign(document.createElement("button"), { type: "button", className: "btn btn--ghost btn--small", textContent: ar ? "لا، شكرًا" : "No thanks" });
  const decide = (c: Consent) => {
    try { localStorage.setItem(CONSENT_KEY, c); } catch { /* the banner returns next visit */ }
    box.remove();
    if (c === "granted") loadGoogle();
  };
  yes.addEventListener("click", () => decide("granted"));
  no.addEventListener("click", () => decide("denied"));
  const actions = document.createElement("div");
  actions.className = "consent__actions";
  actions.append(no, yes);
  box.append(text, actions);
  document.body.append(box);
}

export function initAnalytics(): void {
  inject({ mode: import.meta.env.PROD ? "production" : "development" });
  if (!GA_ID) return;
  const consent = readConsent();
  if (consent === "granted") loadGoogle();
  else if (consent === null) banner();
  document.querySelectorAll<HTMLElement>("[data-cookie-settings]").forEach((el) => {
    el.hidden = false;
    el.addEventListener("click", () => {
      try { localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
      if (!document.querySelector(".consent")) banner();
    });
  });
}

/** Count an event. Only a name and a short, non-identifying label such as an export format. */
export function countEvent(name: "match_run" | "map_export" | "file_export" | "map_made", format?: string): void {
  const props = format ? { format } : undefined;
  try { track(name, props); } catch { /* analytics must never break the page */ }
  // The site's own counter: page, event and format, nothing else. Not sent from local development.
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    try {
      const body = JSON.stringify({ page: document.body.dataset.page ?? "", event: name, format: format ?? "" });
      if (!navigator.sendBeacon?.("/api/count", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/count", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch { /* counting must never break the page */ }
  }
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (gtag) gtag("event", name, props ?? {});
}
