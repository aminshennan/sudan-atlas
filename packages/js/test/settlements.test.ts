// Village, town and camp matching must return exactly what the Python matcher returns.
// data/tests/settlement_results.json holds the Python results with settlements=True (regenerate with `make golden`).
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Matcher } from "../src/match.js";
import { loadSettlements } from "../src/settlements.js";

interface GoldenRow {
  id: string;
  input_name: string;
  state_hint: string;
  level: 2;
  result: unknown;
}

const golden: GoldenRow[] = JSON.parse(readFileSync(new URL("../../../data/tests/settlement_results.json", import.meta.url), "utf8"));

describe("village matching", () => {
  it("asks for the data to be loaded first", () => {
    expect(() => new Matcher().match("Zamzam", { stateHint: "SD02", level: 2, settlements: true })).toThrow(/loadSettlements/);
  });

  describe("identical results to the Python matcher", () => {
    const matcher = new Matcher();
    beforeAll(async () => {
      await loadSettlements();
    });
    it("covers the sample", () => expect(golden.length).toBeGreaterThanOrEqual(300));
    it.each(golden)("$id: $input_name", (row) => {
      const result = matcher.match(row.input_name, { stateHint: row.state_hint || null, level: row.level, settlements: true });
      expect(result).toEqual(row.result);
    });
  });

  it("leaves results unchanged without the option", () => {
    const matcher = new Matcher();
    expect(matcher.match("Zamzam", { stateHint: "North Darfur", level: 2 })).not.toHaveProperty("settlement");
  });
});
