// English is written in the HTML; Arabic comes from this dictionary. Elements carry
// data-i18n="key" (text) or data-i18n-attr="attr:key;attr:key" (attributes). Long-form
// pages instead pair whole elements, data-lang-only="en" and data-lang-only="ar", and the
// one for the other language is hidden.
// Switching language sets <html lang dir>, is remembered, and fires "sa:lang" so
// pages can redraw what they render themselves (map labels, tables).

export type Lang = "en" | "ar";

const AR: Record<string, string> = {
  skip: "تخطَّ إلى المحتوى",
  "hud.label": "إحداثيات الخريطة",
  "brand.home": "أطلس السودان: الصفحة الرئيسية",
  "nav.label": "القائمة الرئيسية",
  "nav.map": "الخريطة",
  "nav.maker": "صانع الخرائط",
  "nav.docs": "الدليل",
  "nav.sources": "المصادر",
  "nav.about": "عن الأطلس",
  "footer.credit": "مصدر الحدود: مجموعة COD-AB للسودان (الإصدار الثالث) الصادرة عن أوتشا، برخصة CC BY 3.0 IGO. أما الأسماء والرموز والبرمجيات فمن أطلس السودان، برخصتي CC BY 4.0 وMIT. ولا يعبّر رسم الحدود عن أي موقف من الوضع القانوني لأي إقليم.",
  "footer.links": "روابط المشروع",
  "footer.cite": "الاستشهاد (DOI)",
  "footer.made": "من إعداد",
  "footer.cookies": "إعدادات ملفات تعريف الارتباط",

  "home.eyebrow": "بيانات مفتوحة · رموز مكانية · حدود إدارية",
  "home.title": "كل أماكن السودان في خريطة واحدة.",
  "home.lead": "الأسماء الرسمية بالعربية والإنجليزية، والرموز المكانية (P‑codes)، وحدود 18 ولاية ومنطقة أبيي و189 محلية. تصفّح الخريطة ونزّلها، أو طابِق أسماء الأماكن في جدولك دون أن يغادر ملفك جهازك.",
  "home.cta.map": "افتح الخريطة",
  "home.cta.maker": "حوّل جدولي إلى خريطة",
  "home.card.state": "ولاية",
  "home.card.matching": "المطابقة تجري في متصفحك",
  "home.card.choose": "الاسم يحتمل مكانين، والخيار لك",
  "home.score": "درجة التطابق",
  "home.explore.title": "كل ولاية وكل محلية، باسمها الرسمي.",
  "home.explore.lead": "اختر أي مكان لتعرف اسمه الرسمي بالعربية والإنجليزية ورمزه المكاني ومحلياته، واعرض الأسماء على الخريطة باللغة التي تفضّلها، ثم نزّلها صورةً بصيغة SVG أو PNG.",
  "home.f1.k": "01 · تصفّح",
  "home.f1.t": "خريطة لكل الولايات والمحليات",
  "home.f1.d": "ابحث بالعربية أو الإنجليزية، واختر أي مكان لتطّلع على اسمه الرسمي ورمزه.",
  "home.f2.k": "02 · طابِق",
  "home.f2.t": "مهما اختلفت كتابة الاسم، نصل إلى المكان الصحيح",
  "home.f2.d": "افتح ملف CSV أو Excel، فتجري المطابقة كلها في متصفحك ولا يغادر ملفك جهازك. وإذا احتمل الاسم أكثر من مكان، تركنا القرار لك.",
  "home.f3.k": "03 · نزّل",
  "home.f3.t": "خرائط جاهزة لتقاريرك",
  "home.f3.d": "صور بصيغتي SVG وPNG تتضمن العنوان ومفتاح الألوان والمصدر، ومعها ملفك وقد أُضيف إليه عمود الرموز المكانية.",
  "home.dev.k": "للمطوّرين",
  "home.dev.t": "البيانات نفسها، داخل برامجك.",
  "home.dev.d": "حزمتان، لبايثون وجافاسكربت، تعطيان النتائج نفسها، ومعهما دليل فيه أمثلة للبدء، وحلول لمهام شائعة، ومرجع كامل، وشرح لطريقة المطابقة.",
  "home.dev.link": "اقرأ الدليل",

  "map.title": "خريطة السودان",
  "map.search": "ابحث عن مكان",
  "map.search.placeholder": "اسم ولاية أو محلية، بالعربية أو الإنجليزية",
  "map.search.none": "لا توجد أماكن مطابقة",
  "map.layers": "الطبقات",
  "map.level": "المستوى",
  "map.states": "الولايات",
  "map.localities": "المحليات",
  "map.labels": "أسماء الأماكن",
  "map.labels.off": "إخفاء",
  "map.export": "تنزيل",
  "map.export.svg": "صورة SVG",
  "map.export.png": "صورة PNG",
  "map.export.csv": "جدول الأماكن (CSV)",
  "map.export.note": "تتضمن الصور العنوان والمصدر.",
  "map.details.empty": "اختر مكانًا من الخريطة، أو ابحث عنه بالاسم.",
  "map.state": "ولاية",
  "map.locality": "محلية",
  "map.inState": "تتبع ولاية",
  "map.localityCount": "عدد المحليات",
  "map.copy": "نسخ",
  "map.copied": "نُسخ",
  "map.showLocalities": "اعرض محلياتها على الخريطة",
  "map.loading": "جارٍ تحميل الخريطة…",
  "map.reset": "السودان كاملًا",
  "map.zoomIn": "تكبير",
  "map.zoomOut": "تصغير",
  "map.zoomReset": "عرض الخريطة كاملة",
  "map.crumbs": "مسار التصفح",
  "map.aria": "خريطة ولايات السودان ومحلياته",
  "map.loading.aria": "جارٍ تحميل الخريطة",
  "orb.matching": "جارٍ مطابقة الأسماء",
  "admin1": "المستوى الإداري الأول",
  "admin2": "المستوى الإداري الثاني",
  "copy": "نسخ",
  "copied": "نُسخ",
  "mk.show": "عرض",
  "pal.ylgnbu": "من الأصفر إلى الأزرق",
  "pal.ylorbr": "من الأصفر إلى البني",
  "pal.viridis": "من البنفسجي إلى الأصفر",
  "docs.nav": "أقسام الدليل",
  "docs.examples": "لغة البرمجة في الأمثلة",

  "mk.steps": "الخطوات",
  "mk.s1": "اختر الملف",
  "mk.s2": "حدّد الأعمدة",
  "mk.s3": "راجع المطابقة",
  "mk.s4": "الخريطة والتنزيل",
  "mk.privacy": "يبقى ملفك على جهازك، ولا يُرسل إلى أي خادم.",
  "mk.s1.title": "حوّل جدول أماكن إلى خريطة.",
  "mk.s1.lead": "افتح ملف CSV أو Excel فيه أسماء ولايات أو محليات سودانية، بالعربية أو الإنجليزية ومهما كانت طريقة كتابتها. نطابق كل اسم مع المكان الرسمي ورمزه المكاني، وتراجع أنت ما لم نتأكد منه، ثم تنزّل الخريطة وملفك وقد أُضيفت إليه الرموز.",
  "mk.drop": "اسحب ملف CSV أو Excel وأفلته هنا، أو انقر لاختياره",
  "mk.drop.hint": "‎.csv أو ‎.tsv أو ‎.xlsx · يجب أن يحتوي الصف الأول على أسماء الأعمدة",
  "mk.sample": "جرّب ملفًا نموذجيًا بأسماء مكتوبة بطرق مختلفة",
  "mk.err.xls": "لا نستطيع قراءة ملفات ‎.xls القديمة. احفظ الملف بصيغة ‎.xlsx أو ‎.csv ثم أعد المحاولة.",
  "mk.err.empty": "يجب أن يحتوي الملف على صف لأسماء الأعمدة، وصف واحد من البيانات على الأقل.",
  "mk.err.read": "تعذّرت قراءة الملف.",
  "mk.s2.title": "ماذا يحتوي كل عمود؟",
  "mk.col.name": "أسماء الأماكن",
  "mk.col.state": "الولاية (اختياري، ويرفع دقة المطابقة)",
  "mk.col.value": "القيمة المعروضة على الخريطة (اختياري)",
  "mk.col.level": "نوع الأسماء",
  "mk.col.nostate": "لا يوجد عمود للولاية",
  "mk.col.novalue": "لا توجد قيمة: احسب عدد الصفوف",
  "mk.role.state": "الولاية",
  "mk.role.value": "القيمة",
  "mk.lvl.2": "محليات",
  "mk.lvl.1": "ولايات",
  "mk.lvl.0": "ولايات أو محليات",
  "mk.back": "رجوع",
  "mk.match": "طابِق الأسماء",
  "mk.s3.title": "راجع نتائج المطابقة",
  "mk.f.review": "بحاجة إلى مراجعة",
  "mk.f.none": "بلا مطابقة",
  "mk.f.all": "الكل",
  "mk.tomap": "انتقل إلى الخريطة",
  "mk.th.name": "الاسم في ملفك",
  "mk.th.rows": "عدد الصفوف",
  "mk.th.match": "المكان المطابق",
  "mk.th.how": "طريقة المطابقة",
  "mk.th.status": "الحالة",
  "mk.choose": "اختر مكانًا…",
  "mk.nomatch": "لا يوجد مكان مطابق",
  "mk.m.fixed": "اختيارك",
  "mk.m.empty": "خانة فارغة",
  "mk.st.ok": "مطابَق",
  "mk.st.review": "بحاجة إلى مراجعة",
  "mk.st.none": "بلا مطابقة",
  "mk.st.fixed": "رُوجع",
  "mk.s4.title": "خريطتك",
  "mk.title": "عنوان الخريطة",
  "mk.agg": "إذا تكرر المكان في أكثر من صف",
  "mk.agg.sum": "اجمع القيم",
  "mk.agg.mean": "احسب المتوسط",
  "mk.agg.count": "احسب عدد الصفوف",
  "mk.colours": "الألوان (ملائمة لمن لديهم عمى الألوان)",
  "mk.export.file": "ملفك مع الرموز المكانية",
  "mk.back.review": "عُد إلى المراجعة",
  "mk.skip": "بلا مطابقة: لا تُظهره على الخريطة",
  "mk.m.skipped": "تركته بلا مطابقة",
  "mk.unmapped.check": "راجع المطابقة",
  "mk.file": "اختر ملف CSV أو Excel",
  "mk.hxl": "وُجدت وسوم HXL: اختيرت الأعمدة بناءً عليها، ويحتفظ ملفك بها عند تنزيله.",
  "mk.rank": "الترتيب",
  "mk.bands": "تُظهر الأعمدة عدد الأماكن في كل فئة لونية",
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

let originalTitle: string | null = null;

function apply(root: ParentNode = document): void {
  // Pages give their Arabic title in <meta name="sa:title-ar">.
  const arTitle = document.querySelector<HTMLMetaElement>('meta[name="sa:title-ar"]')?.content;
  if (arTitle) {
    originalTitle ??= document.title;
    document.title = current === "ar" ? arTitle : originalTitle;
  }
  root.querySelectorAll<HTMLElement>("[data-lang-only]").forEach((el) => (el.hidden = el.dataset.langOnly !== current));
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
