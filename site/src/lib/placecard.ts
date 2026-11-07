// The details panel for a selected state or locality: names in both languages, P-code with a
// copy button, facts computed from the data, and the state's localities.
import { areaKm2, getLocalities, getPlace, placeName } from "./atlas";
import { lang, t } from "./i18n";
import type { MapView } from "./mapview";

export interface PlaceCardActions {
  onLocality?: (pcode: string) => void;
  onFocusState?: (pcode: string) => void;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
}

const fmt = (n: number) => new Intl.NumberFormat(lang() === "ar" ? "ar-SD-u-nu-latn" : "en-GB").format(n);

export function renderPlaceCard(container: HTMLElement, pcode: string | null, map: MapView, actions: PlaceCardActions = {}): void {
  container.replaceChildren();
  const place = pcode ? getPlace(pcode) : undefined;
  if (!place) {
    container.append(node("p", { className: "muted", textContent: t("map.details.empty", "Choose a place on the map, or search for one.") }));
    return;
  }
  const L = lang();
  const isState = place.level === 1;
  const card = node("div", { className: "place-card" });
  const parent = isState ? undefined : getPlace(place.parent_pcode);
  card.append(
    node("span", { className: "place-card__kind", textContent: isState ? `${t("map.state", "State")} · admin 1` : `${t("map.locality", "Locality")} · admin 2` }),
    node("span", { className: "place-card__name", textContent: placeName(place, L) }),
    node("span", { className: "place-card__other", lang: L === "ar" ? "en" : "ar", textContent: placeName(place, L === "ar" ? "en" : "ar") }),
  );

  const copy = node("button", { type: "button", className: "btn btn--ghost btn--small", textContent: t("map.copy", "Copy") });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(place.pcode);
      copy.textContent = t("map.copied", "Copied");
      setTimeout(() => (copy.textContent = t("map.copy", "Copy")), 1500);
    } catch {
      /* clipboard can be blocked; the code stays visible to copy by hand */
    }
  });
  card.append(node("div", { className: "place-card__code" }, node("code", { textContent: place.pcode, dir: "ltr" }), copy));

  const area = areaKm2(place.pcode);
  const facts = node("dl");
  const fact = (label: string, value: string) => facts.append(node("div", {}, node("dt", { textContent: label }), node("dd", { textContent: value })));
  if (isState) fact(t("map.localityCount", "Localities"), fmt(getLocalities(place.pcode).length));
  else if (parent) fact(t("map.inState", "In state"), placeName(parent, L));
  if (area) fact(L === "ar" ? "المساحة" : "Area", `≈ ${fmt(area)} ${L === "ar" ? "كم²" : "km²"}`);
  card.append(facts);

  if (isState) {
    const list = node("ul");
    for (const loc of getLocalities(place.pcode)) {
      const b = node("button", { type: "button", textContent: placeName(loc, L) });
      b.addEventListener("click", () => actions.onLocality?.(loc.pcode));
      list.append(node("li", {}, b, node("code", { textContent: loc.pcode, dir: "ltr" })));
    }
    card.append(list);
    if (actions.onFocusState) {
      const zoom = node("button", { type: "button", className: "btn btn--ghost btn--small", textContent: t("map.showLocalities", "Show its localities on the map") });
      zoom.addEventListener("click", () => actions.onFocusState!(place.pcode));
      card.append(zoom);
    }
  } else if (parent && actions.onFocusState) {
    const up = node("button", { type: "button", className: "btn btn--ghost btn--small", textContent: `${placeName(parent, L)} →` });
    up.addEventListener("click", () => actions.onFocusState!(parent.pcode));
    card.append(up);
  }
  container.append(card);
}
