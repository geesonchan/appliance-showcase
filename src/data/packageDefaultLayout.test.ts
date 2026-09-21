import { afterAll, describe, expect, it } from "vitest";
import packagesFile from "../../data/packages.json";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { resetRoom } from "./testRoom";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGES, PACKAGE_BY_ID } from "./packages";
import { ISLAND, REQUESTED_PARAMS } from "./room";
import { packagesFileSchema, parseDataFile } from "./schema";
import type { Package } from "../types";

/**
 * A package can say what its island is, as well as where its walls are.
 * Round 56, the second of four before package E.
 *
 * `defaultLayout` carried the legs and the walls and nothing about the island,
 * so package E's 15" seating overhang, its 72" island, its 36" cabinets and its
 * 48" cooking aisle had nowhere to be written down. Zod drops a key a schema
 * does not name, so writing them in the file would have been silently thrown
 * away — which is the first thing this holds.
 *
 * And the island figures belong to the package that declares them. A package
 * that says nothing about its island leaves the customer's alone, exactly as
 * before; but leaving package E for package A must not carry E's overhang and
 * E's aisle into a kitchen that has neither.
 */

const E_ID = "test-default-layout-island";

/** Package E's shape, with its island figures in its own default room. */
function packageE(): Package {
  // Package E itself since round 69 — one copy of E, in data/packages.json
  // (D17) — in the 240" room these cases were written in.
  const e = PACKAGE_BY_ID["package-e"];
  return { ...e, id: E_ID, defaultLayout: { ...e.defaultLayout, backWallIn: 240 } };
}

afterAll(() => {
  delete PACKAGE_BY_ID[E_ID];
  resetRoom();
});

describe("the data file can say what a package's island is", () => {
  it("keeps the four island figures through the schema rather than dropping them", () => {
    const raw = structuredClone(packagesFile) as { packages: { id: string; defaultLayout?: object }[] };
    const d = raw.packages.find((entry) => entry.id === "package-d")!;
    d.defaultLayout = {
      ...d.defaultLayout,
      islandLengthIn: 78,
      islandDepthIn: 30,
      islandOverhangIn: 12,
      aisleIn: 45,
    };
    const parsed = parseDataFile(packagesFileSchema, raw, "packages.json (test)");
    const layout = parsed.packages.find((entry) => entry.id === "package-d")!.defaultLayout;
    // Four different figures, none of them a default, so a field read into the
    // wrong key could not pass.
    expect(layout.islandLengthIn).toBe(78);
    expect(layout.islandDepthIn).toBe(30);
    expect(layout.islandOverhangIn).toBe(12);
    expect(layout.aisleIn).toBe(45);
  });

  it("leaves every package that ships without one", () => {
    // A to D say nothing about their islands, so choosing one of them cannot
    // have changed: the new fields are absent, not defaulted. E names its own
    // (round 69), below.
    for (const pkg of PACKAGES.filter((entry) => entry.id !== "package-e")) {
      const layout = pkg.defaultLayout as Record<string, unknown>;
      for (const key of ["islandLengthIn", "islandDepthIn", "islandOverhangIn", "aisleIn"]) {
        expect(layout[key], `${pkg.id}.${key}`).toBeUndefined();
      }
    }
  });

  it("gives package E the island D20 settled: 72 by 24, a 15-inch overhang, a 48-inch aisle", () => {
    const layout = PACKAGES.find((entry) => entry.id === "package-e")!.defaultLayout;
    expect({
      length: layout.islandLengthIn,
      depth: layout.islandDepthIn,
      overhang: layout.islandOverhangIn,
      aisle: layout.aisleIn,
    }).toEqual({ length: 72, depth: 24, overhang: 15, aisle: 48 });
  });
});

describe("choosing a package gives it its own island", () => {
  it("takes the overhang, the length, the depth and the aisle from the package", () => {
    PACKAGE_BY_ID[E_ID] = packageE();
    resetRoom();
    const result = setActivePackage(E_ID);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(REQUESTED_PARAMS.islandOverhangIn).toBe(15);
    expect(REQUESTED_PARAMS.islandLengthIn).toBe(72);
    expect(REQUESTED_PARAMS.islandDepthIn).toBe(24);
    expect(REQUESTED_PARAMS.aisleIn).toBe(48);
    // And the room is built with them, not merely asked for them.
    expect(ISLAND.overhangIn).toBe(15);
  });

  it("does not carry them into a package that has no seating overhang", () => {
    PACKAGE_BY_ID[E_ID] = packageE();
    resetRoom();
    expect(setActivePackage(E_ID).ok).toBe(true);
    expect(setActivePackage("package-a").ok).toBe(true);
    expect(REQUESTED_PARAMS.islandOverhangIn ?? 0).toBe(0);
    expect(REQUESTED_PARAMS.aisleIn).toBe(DEFAULT_PARAMS.aisleIn);
    expect(ISLAND.overhangIn).toBe(0);
  });

  it("still leaves the customer's island alone between packages that say nothing about it", () => {
    // What happened before this round, and must still: an island somebody
    // lengthened stays lengthened when they look at another of A to D.
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams({ ...DEFAULT_PARAMS, islandLengthIn: 84, aisleIn: 45 });
    expect(setActivePackage("package-c").ok).toBe(true);
    expect(REQUESTED_PARAMS.islandLengthIn).toBe(84);
    expect(REQUESTED_PARAMS.aisleIn).toBe(45);
  });
});
