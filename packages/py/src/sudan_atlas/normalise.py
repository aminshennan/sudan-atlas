"""Turn a place name into a matching key, following data/gazetteer/normalisation.json.

The rules live in that file so the Python and TypeScript matchers share them.
Each word is treated as Arabic when it contains an Arabic letter, otherwise as Latin.
"""

import re
import unicodedata
from functools import cached_property

ARABIC_LETTER = re.compile(r"[ء-يٮ-ۓۺ-ۿ]")


class Normaliser:
    def __init__(self, rules: dict):
        self.rules = rules

    @cached_property
    def _separators(self) -> re.Pattern:
        return re.compile(self.rules["general"]["word_separators"])

    @cached_property
    def _drop(self) -> re.Pattern:
        return re.compile(self.rules["general"]["drop_characters"])

    @cached_property
    def _arabic_remove(self) -> re.Pattern:
        return re.compile("|".join(self.rules["arabic"]["remove"].values()))

    def key(self, name: str, synonyms: bool = True) -> str:
        """The matching key for name: lower-case Latin and normalised Arabic words, single-spaced."""
        if not name:
            return ""
        text = unicodedata.normalize(self.rules["general"]["unicode_form"], str(name))
        text = self._drop.sub("", text)
        words = [w for w in self._separators.split(text) if w]
        kept = [w for w in (self._word(w, strip=True, synonyms=synonyms) for w in words) if w]
        if kept:
            return " ".join(kept)
        # Everything was an article or a generic word ("Al", "State"): keep the words themselves.
        return " ".join(w for w in (self._word(w, strip=False, synonyms=False) for w in words) if w)

    def keys(self, name: str) -> list[str]:
        """The key with synonyms applied, then without them if that differs ("Centeral Darfur" keeps its own spelling)."""
        main = self.key(name)
        plain = self.key(name, synonyms=False)
        return [main] if plain == main else [main, plain]

    def skeleton(self, key: str) -> str:
        """A consonant skeleton of a Latin key, for fuzzy scoring: transliteration variants merged, inner vowels dropped."""
        if ARABIC_LETTER.search(key):
            return key
        rules = self.rules["latin"]["skeleton"]
        words = []
        for word in key.split():
            for old, new in rules["replace"]:
                word = word.replace(old, new)
            word = word[:1] + "".join(c for c in word[1:] if c not in rules["vowels"])
            words.append(re.sub(r"(.)\1+", r"\1", word))
        skeleton = " ".join(words)
        # Too few letters left to tell places apart ("Total" and "Tawila" both give "tl").
        return skeleton if len(skeleton.replace(" ", "")) >= rules.get("min_length", 0) else ""

    def script(self, name: str) -> str:
        return "ar" if ARABIC_LETTER.search(name or "") else "latin"

    def _word(self, word: str, strip: bool, synonyms: bool) -> str:
        if ARABIC_LETTER.search(word):
            return self._arabic(word, strip, synonyms)
        return self._latin(word, strip, synonyms)

    def _arabic(self, word: str, strip: bool, synonyms: bool) -> str:
        rules = self.rules["arabic"]
        word = self._arabic_remove.sub("", word)
        for old, new in rules["replace"].items():
            word = word.replace(old, new)
        if not strip:
            return word
        if word in {self._arabic_plain(g) for g in rules["generic_words"]}:
            return ""
        if synonyms:
            word = rules.get("synonyms", {}).get(word, word)
        prefix = rules["strip_prefix"]
        if word.startswith(prefix["prefix"]) and len(word) - len(prefix["prefix"]) >= prefix["min_remaining"]:
            word = word[len(prefix["prefix"]):]
        return word

    def _arabic_plain(self, word: str) -> str:
        word = self._arabic_remove.sub("", word)
        for old, new in self.rules["arabic"]["replace"].items():
            word = word.replace(old, new)
        return word

    def _latin(self, word: str, strip: bool, synonyms: bool) -> str:
        rules = self.rules["latin"]
        if rules["strip_accents"]:
            # Drop nonspacing marks (category Mn), as the TypeScript matcher's /\p{Mn}/u does.
            word = "".join(c for c in unicodedata.normalize("NFKD", word) if unicodedata.category(c) != "Mn")
        if rules["lowercase"]:
            word = word.lower()
        word = re.sub(r"[^a-z0-9]", "", word)
        if strip:
            if word in rules["generic_words"] or word in rules["articles"]:
                return ""
            if synonyms:
                word = rules.get("synonyms", {}).get(word, word)
            glued = rules["glued_articles"]
            for prefix in glued["prefixes"]:
                if word.startswith(prefix) and len(word) - len(prefix) >= glued["min_remaining"]:
                    word = word[len(prefix):]
                    break
        for old, new in rules["replace"]:
            word = word.replace(old, new)
        if rules["collapse_double_letters"]:
            word = re.sub(r"(.)\1+", r"\1", word)
        if rules.get("final_h_after_vowel") and len(word) > 3 and word.endswith("h") and word[-2] in "aeiou":
            word = word[:-1]
        return word
