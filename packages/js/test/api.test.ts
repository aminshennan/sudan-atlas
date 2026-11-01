import { describe, expect, it } from "vitest";
import { DATA_VERSION, getFeature, getLocalities, getPlace, getStates, match, RESOLUTIONS, VERSION } from "../src/index.js";

describe("places", () => {
  it("lists the states and localities", () => {
    expect(getStates()).toHaveLength(19);
    expect(getLocalities()).toHaveLength(189);
    expect(getLocalities("sd15").map((p) => p.pcode)).toContain("SD15034");
    expect(getStates().every((s) => s.level === 1 && s.parent_pcode === "SD")).toBe(true);
  });
  it("rejects an unknown state", () => expect(() => getLocalities("SD99")).toThrow(/No state/));
  it("returns copies, so callers cannot change the gazetteer", () => {
    getStates()[0].name_en = "changed";
    expect(getPlace("SD01")?.name_en).toBe("Khartoum");
  });
  it("reports its versions", () => {
    expect(DATA_VERSION).toBe("2026.1");
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("getFeature", () => {
  it("loads a boundary from the package's data folder", async () => {
    const feature = await getFeature("sd02114", "light");
    expect(feature.properties.pcode).toBe("SD02114");
    expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
  });
  it("has every resolution for a state", async () => {
    for (const r of RESOLUTIONS) expect((await getFeature("SD15", r)).properties.level).toBe(1);
  });
  it("rejects unknown codes and resolutions", async () => {
    await expect(getFeature("SD99")).rejects.toThrow(/No place/);
    // @ts-expect-error: not a resolution
    await expect(getFeature("SD01", "huge")).rejects.toThrow(/resolution/);
  });
});

describe("match", () => {
  it("matches with a state hint and level", () => {
    const result = match("El Hasaheesa", { stateHint: "Al Gezira", level: 2 });
    expect(result.pcode).toBe("SD15034");
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
  });
  it("does not guess between equally good places", () => {
    expect(match("Ar Rahad", { level: 2 }).method).toBe("ambiguous");
    expect(match("Ar Rahad", { stateHint: "Gedaref", level: 2 }).pcode).toBe("SD12084");
  });
  it("returns no match for non-places", () => expect(match("Total", { level: 2 }).pcode).toBeNull());
});
