// English is written in the HTML; Arabic comes from this dictionary. Elements carry
// data-i18n="key" (text) or data-i18n-attr="attr:key;attr:key" (attributes).
// Switching language sets <html lang dir>, is remembered, and fires "sa:lang" so
// pages can redraw what they render themselves (map labels, tables).

export type Lang = "en" | "ar";

const AR: Record<string, string> = {
  skip: "انتقل إلى المحتوى",
  "hud.label": "موقع الخريطة",
  "brand.home": "أطلس السودان، الصفحة الرئيسية",
  "nav.label": "القائمة الرئيسية",
  "nav.map": "الخريطة",
  "nav.maker": "صانع الخرائط",
  "nav.docs": "التوثيق",
  "nav.sources": "البيانات",
  "nav.about": "عن المشروع",
  "footer.credit": "الحدود: أوتشا، COD-AB السودان، الإصدار 3، برخصة CC BY 3.0 IGO. الأسماء والرموز والبرمجيات: أطلس السودان، برخصتي CC BY 4.0 وMIT. لا تعني الحدود أي رأي في الوضع القانوني لأي إقليم.",
  "footer.links": "روابط المشروع",
  "footer.made": "من إعداد",

  "home.eyebrow": "بيانات مفتوحة · رموز المواقع · الحدود",
  "home.title": "كل مكان في السودان، على خريطة واحدة.",
  "home.lead": "الأسماء الرسمية بالعربية والإنجليزية، ورموز المواقع (P-codes) والحدود لـ19 ولاية و189 محلية. استكشف الخريطة وصدّرها، أو طابِق جدولك، دون رفع أي شيء.",
  "home.cta.map": "افتح الخريطة",
  "home.cta.maker": "ارسم خريطة من جدولي",
  "home.card.state": "ولاية",
  "home.card.matching": "تتم المطابقة في متصفحك",
  "home.card.choose": "مكانان: الاختيار لك",
  "home.score": "الدرجة",
  "home.explore.title": "كل ولاية ومحلية، باسمها الصحيح.",
  "home.explore.lead": "اختر أي مكان لترى أسماءه الرسمية ورمزه ومحلياته، وبدّل الأسماء بين العربية والإنجليزية، ثم صدّر الخريطة بصيغة SVG أو PNG.",
  "home.f1.k": "01 · استكشف",
  "home.f1.t": "خريطة لكل ولاية ومحلية",
  "home.f1.d": "ابحث بالعربية أو الإنجليزية، واختر أي مكان، واقرأ أسماءه الرسمية ورمزه.",
  "home.f2.k": "02 · طابِق",
  "home.f2.t": "أسماء غير منظمة، مطابَقة مع المكان الصحيح",
  "home.f2.d": "ارفع ملف CSV أو Excel. تتم المطابقة في متصفحك ولا يُرفع الملف أبدًا. وحين يحتمل الاسم مكانين، يكون القرار لك.",
  "home.f3.k": "03 · صدّر",
  "home.f3.t": "خرائط جاهزة لتقريرك",
  "home.f3.d": "SVG وPNG مع العنوان ومفتاح الألوان ونسبة المصدر، وملفك مع عمود لرموز المواقع.",
  "home.dev.k": "للمطوّرين",
  "home.dev.t": "البيانات نفسها في برامجك.",
  "home.dev.d": "حزمتان لبايثون وجافاسكربت بنتائج متطابقة، مع دروس وأدلة عملية ومرجع كامل وشرح لطريقة المطابقة.",
  "home.dev.link": "اقرأ التوثيق",

  "map.title": "خريطة السودان",
  "map.search": "ابحث عن مكان",
  "map.search.placeholder": "208 أماكن، بالعربية أو الإنجليزية",
  "map.layers": "الطبقات",
  "map.level": "المستوى",
  "map.states": "الولايات",
  "map.localities": "المحليات",
  "map.labels": "الأسماء",
  "map.labels.off": "بدون",
  "map.export": "تصدير",
  "map.export.svg": "صورة SVG",
  "map.export.png": "صورة PNG",
  "map.export.csv": "الأماكن بصيغة CSV",
  "map.export.note": "تتضمن الصور العنوان ونسبة المصدر.",
  "map.details.empty": "اختر مكانًا على الخريطة أو ابحث عنه.",
  "map.state": "ولاية",
  "map.locality": "محلية",
  "map.inState": "في ولاية",
  "map.localityCount": "عدد المحليات",
  "map.copy": "نسخ",
  "map.copied": "تم النسخ",
  "map.showLocalities": "اعرض محلياتها على الخريطة",
  "map.loading": "جارٍ تحميل الخريطة…",
  "map.reset": "كل السودان",

  "mk.steps": "الخطوات",
  "mk.s1": "ارفع الملف",
  "mk.s2": "الأعمدة",
  "mk.s3": "راجع المطابقات",
  "mk.s4": "الخريطة والتصدير",
  "mk.privacy": "يبقى ملفك في متصفحك. لا يُرفع أي شيء.",
  "mk.s1.title": "حوّل جدولًا من أسماء الأماكن إلى خريطة.",
  "mk.s1.lead": "ارفع ملف CSV أو Excel فيه أسماء ولايات أو محليات سودانية، بالعربية أو الإنجليزية وبأي تهجئة. نطابق كل اسم مع مكانه الرسمي ورمزه، وتراجع أنت الأسماء غير المؤكدة، ثم تصدّر خريطة وملفك مع رموز المواقع.",
  "mk.drop": "أفلت ملف CSV أو Excel هنا، أو انقر لاختياره",
  "mk.drop.hint": ".csv أو .tsv أو .xlsx · يجب أن يحمل الصف الأول أسماء الأعمدة",
  "mk.sample": "جرّب ملفًا نموذجيًا بأسماء غير منظمة",
  "mk.err.xls": "لا يمكن قراءة ملفات ‎.xls القديمة. احفظ الملف بصيغة ‎.xlsx أو ‎.csv وحاول مجددًا.",
  "mk.err.empty": "يحتاج الملف إلى صف عناوين وصف بيانات واحد على الأقل.",
  "mk.err.read": "تعذّرت قراءة الملف.",
  "mk.s2.title": "أي الأعمدة يحمل ماذا؟",
  "mk.col.name": "أسماء الأماكن",
  "mk.col.state": "الولاية (اختياري، يحسّن المطابقة)",
  "mk.col.value": "القيمة على الخريطة (اختياري)",
  "mk.col.level": "الأسماء هي",
  "mk.col.nostate": "لا يوجد عمود للولاية",
  "mk.col.novalue": "بلا قيمة: عدّ الصفوف",
  "mk.role.state": "الولاية",
  "mk.role.value": "القيمة",
  "mk.lvl.2": "محليات",
  "mk.lvl.1": "ولايات",
  "mk.lvl.0": "أيّ منهما",
  "mk.back": "رجوع",
  "mk.match": "طابِق الأسماء",
  "mk.s3.title": "راجع المطابقات",
  "mk.f.review": "تحتاج مراجعة",
  "mk.f.none": "بلا تطابق",
  "mk.f.all": "الكل",
  "mk.tomap": "تابع إلى الخريطة",
  "mk.th.name": "في ملفك",
  "mk.th.rows": "الصفوف",
  "mk.th.match": "المكان المطابق",
  "mk.th.how": "طريقة المطابقة",
  "mk.th.status": "الحالة",
  "mk.choose": "اختر مكانًا…",
  "mk.nomatch": "لا تطابق",
  "mk.m.fixed": "اخترته أنت",
  "mk.m.empty": "فارغ",
  "mk.st.ok": "مطابَق",
  "mk.st.review": "تحتاج مراجعة",
  "mk.st.none": "لا تطابق",
  "mk.st.fixed": "تمت المراجعة",
  "mk.s4.title": "خريطتك",
  "mk.title": "العنوان",
  "mk.agg": "دمج الصفوف للمكان نفسه",
  "mk.agg.sum": "مجموع القيم",
  "mk.agg.mean": "متوسط القيم",
  "mk.agg.count": "عدد الصفوف",
  "mk.colours": "الألوان (مناسبة لعمى الألوان)",
  "mk.export.file": "ملفك مع رموز المواقع",
  "mk.back.review": "رجوع إلى المطابقات",
  "mk.nodata": "لا توجد بيانات",
};

const STORAGE_KEY = "sa-lang";
const originals = new WeakMap<Element, string>();
const originalAttrs = new WeakMap<Element, Record<string, string>>();
let current: Lang = "en";

export function lang(): Lang {
  return current;
}

/** The Arabic for a key, or the English fallback given. */
export function t(key: string, english: string): string {
  return current === "ar" ? AR[key] ?? english : english;
}

function readSaved(): Lang | null {
  const param = new URLSearchParams(location.search).get("lang");
  if (param === "ar" || param === "en") return param;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : null;
  } catch {
    return null;
  }
}

function apply(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    if (!originals.has(el)) originals.set(el, el.textContent ?? "");
    const key = el.dataset.i18n!;
    el.textContent = current === "ar" ? AR[key] ?? originals.get(el)! : originals.get(el)!;
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-attr]").forEach((el) => {
    const saved = originalAttrs.get(el) ?? {};
    for (const pair of el.dataset.i18nAttr!.split(";")) {
      const [attr, key] = pair.split(":");
      if (!(attr in saved)) saved[attr] = el.getAttribute(attr) ?? "";
      el.setAttribute(attr, current === "ar" ? AR[key] ?? saved[attr] : saved[attr]);
    }
    originalAttrs.set(el, saved);
  });
  const toggle = document.querySelector<HTMLButtonElement>("[data-lang-toggle]");
  if (toggle) {
    toggle.textContent = current === "ar" ? "English" : "عربي";
    toggle.lang = current === "ar" ? "en" : "ar";
    toggle.setAttribute("aria-label", current === "ar" ? "Switch to English" : "التبديل إلى العربية");
  }
}

export function setLang(next: Lang, save = true): void {
  current = next;
  document.documentElement.lang = next;
  document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  if (save) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage can be unavailable (private windows); the choice then lasts for this page only */
    }
  }
  apply();
  document.dispatchEvent(new CustomEvent("sa:lang", { detail: next }));
}

export function initI18n(): void {
  current = readSaved() ?? "en";
  setLang(current, false);
  document.querySelector("[data-lang-toggle]")?.addEventListener("click", () => setLang(current === "ar" ? "en" : "ar"));
}

/** Re-apply translations to content a page added after load. */
export function translate(root: ParentNode): void {
  apply(root);
}
