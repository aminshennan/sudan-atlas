import { match } from "sudan-atlas";
import { startPage } from "../main";
import "../styles/map.css";
import "../styles/home.css";
import { areaKm2, getLocalities, placeName } from "../lib/atlas";
import { drawDotMap } from "../lib/dotmap";
import { lang, t } from "../lib/i18n";
import { MapView } from "../lib/mapview";
import { renderPlaceCard } from "../lib/placecard";

startPage("home");

// Hero: Sudan as dots, from the real state boundaries.
const dots = document.querySelector<HTMLElement>("[data-dot-map]");
if (dots) drawDotMap(dots);

// A few messy names, matched live by the same matcher the packages use.
const DEMO = ["Omdurmaan", "الفاشر", "Sharg Elnil", "Gallabat"];
function renderMatches(): void {
  const list = document.querySelector<HTMLUListElement>("[data-match-demo]");
  if (!list) return;
  list.replaceChildren();
  for (const input of DEMO) {
    const r = match(input, { level: 2 });
    const li = document.createElement("li");
    const from = Object.assign(document.createElement("span"), { className: "from", textContent: input });
    const to = document.createElement("span");
    const meta = document.createElement("span");
    meta.className = "meta";
    if (r.pcode) {
      to.className = "to";
      to.textContent = placeName(r, lang());
      meta.append(Object.assign(document.createElement("span"), { textContent: r.pcode }),
        Object.assign(document.createElement("span"), { textContent: `${t("home.score", "score")} ${r.score.toFixed(2)}` }));
    } else {
      to.className = "to ambiguous";
      to.textContent = t("home.card.choose", "2 places: you choose");
      meta.append(Object.assign(document.createElement("span"), { textContent: r.alternatives.slice(0, 2).map((a) => a.pcode).join(" / ") }));
    }
    meta.dir = "ltr";
    li.append(from, to, meta);
    list.append(li);
  }
}
renderMatches();

// A live preview of the map explorer.
const mapBox = document.querySelector<HTMLElement>("[data-home-map]");
const info = document.querySelector<HTMLElement>("[data-home-info]");
if (mapBox && info) {
  let current: string | null = "SD02";
  const labelMode = () => (lang() === "ar" ? "ar" : "en");
  const map = new MapView(mapBox, { labels: labelMode(), onSelect: (pcode) => select(pcode) });
  function select(pcode: string | null): void {
    current = pcode;
    map.select(pcode);
    renderPlaceCard(info!, pcode, map, { onLocality: select });
  }
  function stateFacts(): void {
    const facts = document.querySelector("[data-state-facts]");
    if (!facts) return;
    const n = getLocalities("SD02").length;
    const area = (areaKm2("SD02") ?? 0).toLocaleString("en-GB");
    const ar = lang() === "ar";
    const name = document.querySelector(".float-card__name");
    const other = document.querySelector<HTMLElement>(".float-card__ar");
    if (name) name.textContent = ar ? "شمال دارفور" : "North Darfur";
    if (other) { other.textContent = ar ? "North Darfur" : "شمال دارفور"; other.lang = ar ? "en" : "ar"; }
    facts.textContent = lang() === "ar" ? `${n} محلية · نحو ${area} كم²` : `${n} localities · about ${area} km²`;
  }
  map.load().then(() => {
    select(current);
    stateFacts();
  });
  document.addEventListener("sa:lang", () => {
    map.setLabels(labelMode());
    map.render();
    select(current);
    stateFacts();
    renderMatches();
  });
}
