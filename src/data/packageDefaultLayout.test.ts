import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import packagesFile from "../../data/packages.json";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { resetRoom } from "./testRoom";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGES, PACKAGE_BY_ID } from "./packages";
import { ISLAND, REQUESTED_PARAMS } from "./room";
import { packagesFileSchema, parseDataFile } from "./schema";
import type { Appliance, Package } from "../types";

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

const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;
const E_ID = "test-default-layout-island";

/** Package E's shape, with its island figures in its own default room. */
function packageE(): Package {
  const a = PACKAGE_BY_ID["package-a"];
  const d = PACKAGE_BY_ID["package-d"];
  const b = PACKAGE_BY_ID["package-b"];
  const take = (pkg: Package, slotId: string) => pkg.slots.find((s) => s.slotId === slotId)!;
  const hood = take(a, "slot-hood");
  return {
    ...d,
    id: E_ID,
    columnOrder: ["slot-freezer", "slot-fridge"],
    defaultLayout: {
      sinkLeg: "back",
      fridgeEnd: "left",
      coffeeLeg: "back",
      backWallIn: 240,
      leftWallIn: 168,
      islandLengthIn: 72,
      // D20: "for E that is a 24\" cabinet and 40\" of counter".
      islandDepthIn: 24,
      islandOverhangIn: 15,
      aisleIn: 48,
    },
    slots: [
      { ...take(d, "slot-freezer"), widthIn: 18 },
      take(d, "slot-fridge"),
      { ...take(b, "slot-microwave"), beside: "run" },
      { ...take(d, "slot-coffee"), standsOver: null },
      take(a, "slot-dishwasher"),
      {
        ...hood,
        slotId: "slot-cooktop",
        category: "cooktop",
        widthIn: 36,
        installType: "drop-in",
        builtForCooktopIn: null,
        heightIn: null,
        depthIn: null,
        utilities: { gas: null, power: { voltage: 240, amps: 50, dedicated: true }, duct: null },
      },
      { ...hood, widthIn: 42, installType: "island", builtForCooktopIn: 36 },
    ],
    defaultSelection: {
      "slot-freezer": byModel("T18IF900SP").id,
      "slot-fridge": byModel("T30IR905SP").id,
      "slot-microwave": byModel("MEM301WS").id,
      "slot-coffee": byModel("TCM24PS").id,
      "slot-dishwasher": byModel("SHV78CM3N").id,
      "slot-cooktop": byModel("CIT367YG").id,
      "slot-hood": byModel("HMIB42WS").id,
    },
  } as Package;
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
    // have changed: the new fields are absent, not defaulted.
    for (const pkg of PACKAGES) {
      const layout = pkg.defaultLayout as Record<string, unknown>;
      for (const key of ["islandLengthIn", "islandDepthIn", "islandOverhangIn", "aisleIn"]) {
        expect(layout[key], `${pkg.id}.${key}`).toBeUndefined();
      }
    }
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
