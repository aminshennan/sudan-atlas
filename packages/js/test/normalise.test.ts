import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Normaliser } from "../src/normalise.js";
import { gazetteer } from "../src/gazetteer.js";
import { readCsv } from "./csv.js";

const cases = readCsv(readFileSync(new URL("../../../data/tests/normalisation_cases.csv", import.meta.url), "utf8"));
const normaliser = new Normaliser(gazetteer.rules);

describe("shared normalisation cases (the Python matcher passes the same file)", () => {
  it.each(cases)("$input -> $expected_key ($rule)", ({ input, expected_key }) => {
    expect(normaliser.key(input)).toBe(expected_key);
  });
});

describe("keys and skeletons", () => {
  it("keeps the plain spelling when synonyms change a name", () => {
    expect(normaliser.keys("Central Darfur")).toEqual(["wasat darfur", "central darfur"]);
    expect(normaliser.keys("Kutum")).toEqual(["kutum"]);
  });
  it("drops skeletons too short to tell places apart", () => {
    expect(normaliser.skeleton(normaliser.key("Tawila"))).toBe("");
    expect(normaliser.skeleton(normaliser.key("Qallabat"))).toBe(normaliser.skeleton(normaliser.key("Galabat")));
  });
});
