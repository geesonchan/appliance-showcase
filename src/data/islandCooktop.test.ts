import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { applianceBox } from "./applianceBox";
import { CABINETS } from "./cabinets";
import { counterOutline } from "./counter";
import { fitCheck } from "./fit";
import { islandRiser } from "./islandRiser";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS, type IslandLayout } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { ISLAND, SLOT_BY_ID } from "./slots";
import type { Appliance, Package, PackageSlot } from "../types";

/**
 * slot-cooktop, round 49: CIT367YG in the island, over a drawer base.
 *
 * No package has a cooktop yet — E's own configuration is a later round — so
 * this builds package D with its island microwave drawer taken off and the
 * cooktop put on instead, through the same `setActivePackage` the app uses.
 *
 * Every expected figure is written out from its source, not read back from the
 * code under test: the sheet's cells (showcase_export.csv), the guide's pages
 * (docs/reference/CIT367YG_Installation.pdf), and the island's own extents for
 * which side is which. The working side faces the runs, and the runs stand on
 * the -x and -z walls, so it is the island's lower coordinate across.
 */
const ID = "test-island-cooktop";
const inches = (feet: number) => feet * 12;
const CIT367YG = (appliancesFile as unknown as { appliances: Appliance[] }).appliances.find(
  (entry) => entry.model === "CIT367YG",
)!;

const cooktopSlot: PackageSlot = {
  slotId: "slot-cooktop",
  category: "cooktop",
  widthIn: 36,
  heightIn: null,
  depthIn: null,
  installType: "drop-in",
  builtForCooktopIn: null,
  tallUnit: false,
  beside: null,
  sillIn: 0,
  standsOver: null,
  enclosure: false,
  panelReady: null,
  bestView: null,
  utilities: { gas: null, power: { voltage: 240, amps: 50, dedicated: true }, duct: null },
};

function withCooktop(): Package {
  const d = PACKAGE_BY_ID["package-d"];
  const { "slot-microwave": _dropped, ...selection } = d.defaultSelection;
  return {
    ...d,
    id: ID,
    slots: [...d.slots.filter((slot) => slot.slotId !== "slot-microwave"), cooktopSlot],
    defaultSelection: { ...selection, "slot-cooktop": CIT367YG.id },
  };
}

function build(islandOrientation: "parallel" | "perpendicular") {
  PACKAGE_BY_ID[ID] = withCooktop();
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  expect(setActivePackage(ID).ok).toBe(true);
  const result = setLayoutParamsGrowing({ ...REQUESTED_PARAMS, islandLengthIn: 72, islandOrientation });
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  expect(ISLAND.present).toBe(true);
}

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  delete PACKAGE_BY_ID[ID];
});

const alongOf = (island: IslandLayout) => (island.axis === "x" ? island.x : island.z);
const acrossOf = (island: IslandLayout) => (island.axis === "x" ? island.z : island.x);
/** A plan point in the island's terms: how far along it and how far across. */
const onIsland = (island: IslandLayout, x: number, z: number) =>
  island.axis === "x" ? { along: x, across: z } : { along: z, across: x };

describe("the catalogue has CIT367YG as the sheet has it", () => {
  it("imports the row it used to skip, with the sheet's cells", () => {
    // showcase_export.csv: Width 37, Depth 21-1/4, Height 4, cutoutWidthIn
    // 34-3/4, cutoutHeightIn 3-3/4, cutoutDepthIn 19-7/8, 240V, 50A.
    expect(CIT367YG).toBeDefined();
    expect(CIT367YG.slot).toBe("slot-cooktop");
    expect(CIT367YG.category).toBe("cooktop");
    expect(CIT367YG.fuel).toBe("induction");
    expect([CIT367YG.widthIn, CIT367YG.depthIn, CIT367YG.heightIn]).toEqual([37, 21.25, 4]);
    expect([CIT367YG.cutoutWidthIn, CIT367YG.cutoutHeightIn, CIT367YG.cutoutDepthIn]).toEqual([
      34.75, 3.75, 19.875,
    ]);
    expect([CIT367YG.requires.voltage, CIT367YG.requires.amps]).toEqual([240, 50]);
  });
});

describe.each(["parallel", "perpendicular"] as const)("a cooktop in an island laid %s", (orientation) => {
  it("stands in the middle of the 72 inch island, 18 inches of landing each side, on the working side", () => {
    build(orientation);
    const slot = SLOT_BY_ID["slot-cooktop"];
    expect(slot.mount).toBe("island");
    const along = alongOf(ISLAND);
    const across = acrossOf(ISLAND);
    expect(inches(along[1] - along[0])).toBeCloseTo(72, 6);
    const at = onIsland(ISLAND, slot.position[0], slot.position[2]);
    // The drawer base is 36"; what is left each side of it is the landing.
    expect(inches(at.along - along[0]) - 18).toBeCloseTo(18, 6);
    expect(inches(along[1] - at.along) - 18).toBeCloseTo(18, 6);
    // Centred on the 24" cabinet on the side facing the runs.
    expect(inches(at.across - Math.min(...across))).toBeCloseTo(12, 6);
  });

  it("cuts the counter 34-3/4 x 19-7/8, the width along the island, clear of every edge", () => {
    build(orientation);
    const { pieces } = counterOutline(RUNS, undefined, {
      layout: ISLAND,
      slot: SLOT_BY_ID["slot-cooktop"],
      appliance: CIT367YG,
    });
    const top = pieces[pieces.length - 1];
    expect(top.holes).toHaveLength(1);
    const plan = (points: readonly (readonly [number, number])[]) => {
      const mapped = points.map(([x, z]) => onIsland(ISLAND, x, z));
      const range = (key: "along" | "across") => [
        Math.min(...mapped.map((p) => p[key])),
        Math.max(...mapped.map((p) => p[key])),
      ];
      return { along: range("along"), across: range("across") };
    };
    const hole = plan(top.holes[0]);
    const edge = plan(top.outline);
    expect(inches(hole.along[1] - hole.along[0])).toBeCloseTo(34.75, 6);
    expect(inches(hole.across[1] - hole.across[0])).toBeCloseTo(19.875, 6);
    // Guide page 6: at least 2" to the counter's rear edge — on an island, the
    // seating side — and 2-1/4" to its sides.
    expect(inches(edge.across[1] - hole.across[1])).toBeGreaterThanOrEqual(2);
    expect(inches(hole.along[0] - edge.along[0])).toBeGreaterThanOrEqual(2.25);
    expect(inches(edge.along[1] - hole.along[1])).toBeGreaterThanOrEqual(2.25);
    // And the stone carries on in front of it: a hole that reaches its edge is
    // no hole to the triangulator.
    expect(hole.across[0]).toBeGreaterThan(edge.across[0]);
    // The island's top is that slab, not a box as well.
    expect(CABINETS.find((box) => box.id === "island-counter")).toBeUndefined();
  });

  it("has a drawer base under it with its drawer top 3-3/4 below the counter and 13/16 clear at the back", () => {
    build(orientation);
    const drawers = CABINETS.find((box) => box.id === "island-cooktop-drawers")!;
    const behind = CABINETS.find((box) => box.id === "island-behind-cooktop")!;
    expect(drawers, "no drawer base under the cooktop").toBeDefined();
    expect(behind, "nothing behind the drawer base").toBeDefined();
    // Guide page 7: the top of the drawer at least 3-3/4" below the counter's
    // 36" surface.
    expect(inches(drawers.position[1] + drawers.size[1] / 2)).toBeCloseTo(36 - 3.75, 6);
    const extent = (box: typeof drawers) => {
      const centre = onIsland(ISLAND, box.position[0], box.position[2]);
      const size = onIsland(ISLAND, box.size[0], box.size[2]);
      return {
        along: [centre.along - size.along / 2, centre.along + size.along / 2],
        across: [centre.across - size.across / 2, centre.across + size.across / 2],
      };
    };
    const d = extent(drawers);
    const b = extent(behind);
    const across = acrossOf(ISLAND);
    // Its front is the working face, and its door is drawn on that face.
    expect(d.across[0]).toBeCloseTo(Math.min(...across), 6);
    expect(drawers.facing.sign).toBe(-1);
    // Guide page 7: 13/16" at the back of the cabinet.
    expect(inches(b.across[0] - d.across[1])).toBeCloseTo(13 / 16, 6);
    expect(inches(d.along[1] - d.along[0])).toBeCloseTo(36, 6);
  });

  it("stands the glass about 1/4 inch proud of the counter (4 inch body less the 3-3/4 cutout depth: an inference)", () => {
    build(orientation);
    const slot = SLOT_BY_ID["slot-cooktop"];
    const box = applianceBox(slot, CIT367YG);
    expect(inches(slot.position[1] + box.y + box.h) - 36).toBeCloseTo(0.25, 6);
    expect(inches(box.w)).toBeCloseTo(37, 6);
    expect(inches(box.d)).toBeCloseTo(21.25, 6);
  });

  it("stands its floor riser 6 inches behind it, not under it", () => {
    build(orientation);
    for (const slotId of ["slot-cooktop"] as const) {
      const slot = SLOT_BY_ID[slotId];
      const riser = islandRiser(slot);
      const at = onIsland(ISLAND, slot.position[0], slot.position[2]);
      const up = onIsland(ISLAND, riser.x, riser.z);
      // Along the island it is level with the machine; across, it is further
      // from the working face, which is where "behind" is.
      expect(up.along).toBeCloseTo(at.along, 6);
      expect(inches(up.across - at.across)).toBeCloseTo(6, 6);
    }
  });

  it("quotes no filler beside it: the stone closes round a cooktop, not strips of panel", () => {
    build(orientation);
    const result = fitCheck(SLOT_BY_ID["slot-cooktop"], CIT367YG);
    expect(result.fits).toBe(true);
    expect(result.fillerEachSideIn).toBeNull();
    expect(result.depthOverIn).toBeNull();
  });

  it("passes every layout rule", () => {
    build(orientation);
    expect(checkLayout()).toEqual([]);
  });
});

describe("a cooktop needs an island", () => {
  it("refuses the room without one and offers to put it back", () => {
    build("parallel");
    const result = setLayoutParams({ ...REQUESTED_PARAMS, hasIsland: false });
    expect(result.ok).toBe(false);
    expect(result.reasons.map((reason) => reason.key)).toEqual(["refusal.cooktopIsland"]);
    expect(result.reasons[0].suggestion?.patch).toEqual({ hasIsland: true });
  });
});

describe.each(["parallel", "perpendicular"] as const)("the island riser, island laid %s", (islandOrientation) => {
  it.each(["package-a", "package-c", "package-d"])("stands behind %s's island machines, not under them", (id) => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage(id).ok).toBe(true);
    expect(setLayoutParamsGrowing({ ...REQUESTED_PARAMS, islandOrientation }).ok).toBe(true);
    let checked = 0;
    for (const slot of Object.values(SLOT_BY_ID)) {
      if (slot.mount !== "island") continue;
      checked += 1;
      const riser = islandRiser(slot);
      // 6" from the machine's centre on the plan, whichever way it is turned.
      expect(inches(Math.hypot(riser.x - slot.position[0], riser.z - slot.position[2])), slot.id).toBeCloseTo(6, 6);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
