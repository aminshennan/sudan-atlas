"""Match a messy Sudanese state or locality name to its official record.

Order: exact match on the normalised official names, then the variants table,
then fuzzy matching, all restricted to one state when a state hint is given.
The matcher never guesses silently: below the threshold, or when two places
score too close to call, it returns no match plus the best alternatives.
"""

import re
from functools import lru_cache

from rapidfuzz import fuzz, process

from .gazetteer import Gazetteer
from .normalise import Normaliser

# Provisional: the best setting on the unverified test set (docs/MATCHER_EVALUATION.md).
# The final threshold is set after the test-set review.
DEFAULT_THRESHOLD = 0.75
DEFAULT_MARGIN = 0.05

EXACT_SCORE = 1.0
VARIANT_SCORE = 0.98
PART_PENALTY = 0.97  # a match on part of the input ("Bahri" in "Khartoum North (Bahri)") ranks below a full-name match
SKELETON_WEIGHT = 0.9  # consonant skeletons agree ("Qallabat" / "Galabat"): strong evidence, but not as strong as spelling
SUBSET_WEIGHT = 0.9  # every word of the shorter name appears in the longer ("Um Dam" / "Um Dam Haj Ahmed")
SUBSET_MIN_LETTERS = 4  # ...but only when the shorter name is long enough to mean something


def combined(normaliser):
    """The best of several views of two keys: spelling, word order, spacing, consonant skeleton and partial names."""
    skeleton = lru_cache(maxsize=None)(normaliser.skeleton)

    def score(a: str, b: str, **_) -> float:
        best = max(fuzz.ratio(a, b), fuzz.token_sort_ratio(a, b), fuzz.ratio(a.replace(" ", ""), b.replace(" ", "")))
        sa, sb = skeleton(a), skeleton(b)
        if sa and sb and sa != a:
            best = max(best, SKELETON_WEIGHT * fuzz.ratio(sa, sb))
        if min(len(a.replace(" ", "")), len(b.replace(" ", ""))) >= SUBSET_MIN_LETTERS:
            best = max(best, SUBSET_WEIGHT * fuzz.token_set_ratio(a, b))
        return best

    return score


SCORERS = {
    "ratio": lambda _: fuzz.ratio,
    "token_sort": lambda _: fuzz.token_sort_ratio,
    "wratio": lambda _: fuzz.WRatio,
    "combined": combined,
}

PARTS = re.compile(r"\(([^)]*)\)|/")


class Matcher:
    def __init__(self, gazetteer: Gazetteer | None = None, threshold: float = DEFAULT_THRESHOLD,
                 margin: float = DEFAULT_MARGIN, scorer: str = "combined"):
        self.gazetteer = gazetteer or Gazetteer.load()
        self.normaliser = Normaliser(self.gazetteer.rules)
        self.threshold = threshold
        self.margin = margin
        self.scorer = SCORERS[scorer](self.normaliser)
        self._index: dict[str, dict[str, str]] = {}  # key -> {pcode: "exact" | "variant"}
        for place in self.gazetteer.places.values():
            for name in (place["name_en"], place["name_ar"]):
                self._add(name, place["pcode"], "exact")
        for variant in self.gazetteer.variants:
            for pcode in variant["pcodes"]:
                if pcode in self.gazetteer.places:
                    self._add(variant["text"], pcode, "variant")
        self._fuzzy_choices = lru_cache(maxsize=256)(self._choices)

    def _add(self, name: str, pcode: str, method: str) -> None:
        for key in self.normaliser.keys(name):
            if not key:
                continue
            current = self._index.setdefault(key, {})
            if current.get(pcode) != "exact":
                current[pcode] = method

    def _choices(self, script: str, allowed: frozenset | None) -> tuple[str, ...]:
        return tuple(
            key for key, pcodes in self._index.items()
            if self.normaliser.script(key) == script and (allowed is None or allowed & pcodes.keys())
        )

    def _allowed(self, level: int | None, state: str | None) -> frozenset | None:
        if level is None and state is None:
            return None
        return frozenset(
            p["pcode"] for p in self.gazetteer.places.values()
            if (level is None or p["level"] == level)
            and (state is None or p["pcode"] == state or p["parent_pcode"] == state)
        )

    def resolve_state(self, hint: str | None) -> str | None:
        """The state P-code a hint names (a P-code or a name in any spelling), or None."""
        if not hint:
            return None
        hint = str(hint).strip()
        if hint.upper() in self.gazetteer.places and self.gazetteer.places[hint.upper()]["level"] == 1:
            return hint.upper()
        return self.match(hint, level=1)["pcode"]

    def _inputs(self, name: str) -> list[tuple[str, float]]:
        """The full name, then its parts: text in brackets, text outside them, and each side of a slash."""
        inputs = [(name, 1.0)]
        inside = re.findall(r"\(([^)]*)\)", name)
        outside = re.sub(r"\([^)]*\)", " ", name)
        parts = inside + [outside] + (outside.split("/") if "/" in outside else [])
        for part in parts:
            if part.strip() and part.strip() != name.strip():
                inputs.append((part, PART_PENALTY))
        return inputs

    def candidates(self, name: str, level: int | None = None, state: str | None = None) -> dict[str, tuple[float, str]]:
        """Best (score, method) per P-code for name, within the allowed level and state."""
        allowed = self._allowed(level, state)
        best: dict[str, tuple[float, str]] = {}

        def offer(pcode: str, score: float, method: str) -> None:
            if allowed is not None and pcode not in allowed:
                return
            if pcode not in best or score > best[pcode][0]:
                best[pcode] = (round(score, 4), method)

        keys = [(key, weight) for text, weight in self._inputs(name) for key in self.normaliser.keys(text) if key]
        for key, weight in keys:
            for pcode, method in self._index.get(key, {}).items():
                offer(pcode, (EXACT_SCORE if method == "exact" else VARIANT_SCORE) * weight, method)
            choices = self._fuzzy_choices(self.normaliser.script(key), allowed)
            for choice, score, _ in process.extract(key, choices, scorer=self.scorer, limit=10):
                if choice == key:
                    continue
                for pcode in self._index[choice]:
                    offer(pcode, score / 100 * weight, "fuzzy")
        return best

    def rank(self, name: str, state_hint: str | None = None, level: int | None = None) -> list[tuple[str, float, str]]:
        """Every candidate as (pcode, score, method), best first."""
        state = self.resolve_state(state_hint) if state_hint else None
        found = self.candidates(str(name or ""), level, state)
        return [(p, s, m) for p, (s, m) in sorted(found.items(), key=lambda kv: (-kv[1][0], kv[0]))]

    def decide(self, ranked: list[tuple[str, float, str]]) -> dict:
        """Turn ranked candidates into a result: a match only above the threshold and clear of the runner-up."""
        def record(pcode: str, score: float) -> dict:
            place = self.gazetteer.places[pcode]
            return {"pcode": pcode, "name_en": place["name_en"], "name_ar": place["name_ar"],
                    "level": place["level"], "score": score}

        if ranked:
            top, score, method = ranked[0]
            runner_up = ranked[1][1] if len(ranked) > 1 else 0.0
            if score >= self.threshold and score - runner_up >= self.margin:
                return {**record(top, score), "method": method,
                        "alternatives": [record(p, s) for p, s, _ in ranked[1:4]]}
            outcome = "ambiguous" if score >= self.threshold else "none"
        else:
            outcome = "none"
        return {"pcode": None, "name_en": None, "name_ar": None, "level": None,
                "score": ranked[0][1] if ranked else 0.0, "method": outcome,
                "alternatives": [record(p, s) for p, s, _ in ranked[:3]]}

    def match(self, name: str, state_hint: str | None = None, level: int | None = None) -> dict:
        """The official record for name, or no match plus up to three alternatives.

        Result: {pcode, name_en, name_ar, level, score, method, alternatives}. method is
        exact, variant or fuzzy for a match, and ambiguous or none otherwise.
        """
        return self.decide(self.rank(name, state_hint, level))


_default: Matcher | None = None


def match(name: str, state_hint: str | None = None, level: int | None = None) -> dict:
    """Match name with the bundled gazetteer and default settings."""
    global _default
    if _default is None:
        _default = Matcher()
    return _default.match(name, state_hint=state_hint, level=level)
