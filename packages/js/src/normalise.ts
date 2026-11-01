// Turn a place name into a matching key, following data/gazetteer/normalisation.json.
// The twin of packages/py/src/sudan_atlas/normalise.py: keep the two in step.

export const ARABIC_LETTER = /[ء-يٮ-ۓۺ-ۿ]/;

export interface NormalisationRules {
  general: { unicode_form: string; word_separators: string; drop_characters: string };
  arabic: {
    remove: Record<string, string>;
    replace: Record<string, string>;
    strip_prefix: { prefix: string; min_remaining: number };
    generic_words: string[];
    synonyms?: Record<string, string>;
  };
  latin: {
    lowercase: boolean;
    strip_accents: boolean;
    articles: string[];
    glued_articles: { prefixes: string[]; min_remaining: number };
    collapse_double_letters: boolean;
    replace: [string, string][];
    final_h_after_vowel?: boolean;
    generic_words: string[];
    synonyms?: Record<string, string>;
    skeleton: { replace: [string, string][]; vowels: string; min_length?: number };
  };
}

const replaceAll = (text: string, from: string, to: string) => text.split(from).join(to);

export class Normaliser {
  private readonly separators: RegExp;
  private readonly drop: RegExp;
  private readonly arabicRemove: RegExp;
  private readonly arabicGeneric: Set<string>;
  private readonly latinGeneric: Set<string>;
  private readonly articles: Set<string>;

  constructor(readonly rules: NormalisationRules) {
    this.separators = new RegExp(rules.general.word_separators);
    this.drop = new RegExp(rules.general.drop_characters, "g");
    this.arabicRemove = new RegExp(Object.values(rules.arabic.remove).join("|"), "g");
    this.arabicGeneric = new Set(rules.arabic.generic_words.map((w) => this.arabicPlain(w)));
    this.latinGeneric = new Set(rules.latin.generic_words);
    this.articles = new Set(rules.latin.articles);
  }

  /** The matching key for name: lower-case Latin and normalised Arabic words, single-spaced. */
  key(name: string, synonyms = true): string {
    if (!name) return "";
    let text = String(name).normalize(this.rules.general.unicode_form as "NFKC");
    text = text.replace(this.drop, "");
    const words = text.split(this.separators).filter((w) => w);
    const kept = words.map((w) => this.word(w, true, synonyms)).filter((w) => w);
    if (kept.length) return kept.join(" ");
    // Everything was an article or a generic word ("Al", "State"): keep the words themselves.
    return words.map((w) => this.word(w, false, false)).filter((w) => w).join(" ");
  }

  /** The key with synonyms applied, then without them if that differs. */
  keys(name: string): string[] {
    const main = this.key(name);
    const plain = this.key(name, false);
    return plain === main ? [main] : [main, plain];
  }

  /** A consonant skeleton of a Latin key, for fuzzy scoring. */
  skeleton(key: string): string {
    if (ARABIC_LETTER.test(key)) return key;
    const rules = this.rules.latin.skeleton;
    const words = key.split(" ").map((word) => {
      for (const [from, to] of rules.replace) word = replaceAll(word, from, to);
      word = word.slice(0, 1) + [...word.slice(1)].filter((c) => !rules.vowels.includes(c)).join("");
      return word.replace(/(.)\1+/g, "$1");
    });
    const skeleton = words.join(" ");
    // Too few letters left to tell places apart ("Total" and "Tawila" both give "tl").
    return skeleton.replaceAll(" ", "").length >= (rules.min_length ?? 0) ? skeleton : "";
  }

  script(name: string): "ar" | "latin" {
    return ARABIC_LETTER.test(name || "") ? "ar" : "latin";
  }

  private word(word: string, strip: boolean, synonyms: boolean): string {
    return ARABIC_LETTER.test(word) ? this.arabic(word, strip, synonyms) : this.latin(word, strip, synonyms);
  }

  private arabicPlain(word: string): string {
    word = word.replace(new RegExp(Object.values(this.rules.arabic.remove).join("|"), "g"), "");
    for (const [from, to] of Object.entries(this.rules.arabic.replace)) word = replaceAll(word, from, to);
    return word;
  }

  private arabic(word: string, strip: boolean, synonyms: boolean): string {
    const rules = this.rules.arabic;
    word = word.replace(this.arabicRemove, "");
    for (const [from, to] of Object.entries(rules.replace)) word = replaceAll(word, from, to);
    if (!strip) return word;
    if (this.arabicGeneric.has(word)) return "";
    if (synonyms) word = rules.synonyms?.[word] ?? word;
    const { prefix, min_remaining } = rules.strip_prefix;
    if (word.startsWith(prefix) && word.length - prefix.length >= min_remaining) word = word.slice(prefix.length);
    return word;
  }

  private latin(word: string, strip: boolean, synonyms: boolean): string {
    const rules = this.rules.latin;
    // Drop nonspacing marks (category Mn), as the Python matcher does.
    if (rules.strip_accents) word = word.normalize("NFKD").replace(/\p{Mn}/gu, "");
    if (rules.lowercase) word = word.toLowerCase();
    word = word.replace(/[^a-z0-9]/g, "");
    if (strip) {
      if (this.latinGeneric.has(word) || this.articles.has(word)) return "";
      if (synonyms) word = rules.synonyms?.[word] ?? word;
      const glued = rules.glued_articles;
      for (const prefix of glued.prefixes) {
        if (word.startsWith(prefix) && word.length - prefix.length >= glued.min_remaining) {
          word = word.slice(prefix.length);
          break;
        }
      }
    }
    for (const [from, to] of rules.replace) word = replaceAll(word, from, to);
    if (rules.collapse_double_letters) word = word.replace(/(.)\1+/g, "$1");
    if (rules.final_h_after_vowel && word.length > 3 && word.endsWith("h") && "aeiou".includes(word[word.length - 2])) {
      word = word.slice(0, -1);
    }
    return word;
  }
}
