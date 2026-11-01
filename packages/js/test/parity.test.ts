// The TypeScript and Python matchers must return identical results. data/tests/match_results.json holds the
// Python matcher's result for every test case (regenerate with `make golden`); every field must agree here.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Matcher } from "../src/match.js";

interface GoldenRow {
  id: string;
  input_name: string;
  state_hint: string;
  level: 1 | 2;
  result: unknown;
}

const golden: GoldenRow[] = JSON.parse(readFileSync(new URL("../../../data/tests/match_results.json", import.meta.url), "utf8"));
const matcher = new Matcher();

describe("identical results to the Python matcher", () => {
  it("covers every test case", () => expect(golden.length).toBeGreaterThanOrEqual(299));
  it.each(golden)("$id: $input_name", (row) => {
    const result = matcher.match(row.input_name, { stateHint: row.state_hint || null, level: row.level });
    expect(result).toEqual(row.result);
  });
});
