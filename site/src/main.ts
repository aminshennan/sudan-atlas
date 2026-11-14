// Shared start-up for every page: fonts (self-hosted, no third-party requests), styles,
// language, the current page in the menu, loading animations and analytics.
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "./styles/base.css";
import { initAnalytics } from "./lib/analytics";
import { initI18n } from "./lib/i18n";
import { mountLoaders } from "./lib/loader";

export function startPage(page: string): void {
  initI18n();
  document.querySelector(`[data-nav="${page}"]`)?.setAttribute("aria-current", "page");
  mountLoaders();
  initAnalytics();
}
