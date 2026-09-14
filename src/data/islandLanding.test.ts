import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS, type IslandLayout } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { ISLAND, REQUESTED_PARAMS, RUNS } from "./room";
import type { Appliance, Package, PackageSlot } from "../types";

/**
 * D11 rule 4's island branch, round 50 (D22 step 2).
 *
 * A cooktop in the island has 15" of counter on one side and 12" on the other,
 * along the island's length, measured to the end of the island or to the next
 * opening in it (D20). Until now nothing checked it: E's 18" and 18" on a 72"
 * island were kept only by the arithmetic that laid it out, and an island
 * dragged to 60" left 12" and 12" with nobody saying so. It is held twice here:
 * by the rule, with an island written out by hand, and by the room, which must
 * refuse the island rather than build it.
 */
const ID = "test-island-landing";
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

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  delete PACKAGE_BY_ID[ID];
});

/** An island written out by hand: `lengthIn` long, a 36" cooktop at `fromIn` along it. */
function handIsland(axis: "x" | "z", lengthIn: number, fromIn: number): IslandLayout {
  const ft = (inches: number) => inches / 12;
  const along = [-ft(lengthIn) / 2, ft(lengthIn) / 2] as const;
  const across = [ft(40), ft(76)] as const;
  const start = along[0] + ft(fromIn);
  const empty = [along[0], along[0]] as const;
  return {
    ...ISLAND,
    present: true,
    axis,
    x: axis === "x" ? along : across,
    z: axis === "x" ? across : along,
    working: across[0],
    seating: across[1],
    overhangIn: 0,
    microwave: empty,
    wine: [along[1], along[1]] as const,
    cooktop: [start, start + ft(36)] as const,
  };
}

const landingProblems = (island: IslandLayout) =>
  checkLayout(RUNS, undefined, island).filter((v) => v.code === "d11-4" && v.message.includes("cooktop"));

describe.each(["x", "z"] as const)("rule 4 on an island along %s", (axis) => {
  it("fails 12 and 12, an island of 60 inches with the cooktop in the middle", () => {
    expect(landingProblems(handIsland(axis, 60, 12))).not.toEqual([]);
  });

  it("fails 15 and 9: the wide side is there and the narrow one is not", () => {
    expect(landingProblems(handIsland(axis, 60, 15))).not.toEqual([]);
  });

  it("passes 15 and 12, and 18 and 18", () => {
    expect(landingProblems(handIsland(axis, 63, 15))).toEqual([]);
    expect(landingProblems(handIsland(axis, 72, 18))).toEqual([]);
  });
});

describe.each(["parallel", "perpendicular"] as const)("a room with a cooktop island laid %s", (islandOrientation) => {
  const open = () => {
    PACKAGE_BY_ID[ID] = withCooktop();
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage(ID).ok).toBe(true);
  };

  it("refuses a 60 inch island and offers the shortest one that has its landings", () => {
    open();
    const result = setLayoutParams({ ...REQUESTED_PARAMS, islandOrientation, islandLengthIn: 60 });
    expect(result.ok).toBe(false);
    const refusal = result.reasons.find((reason) => reason.key === "refusal.cooktopLanding");
    expect(refusal, JSON.stringify(result.reasons)).toBeDefined();
    // 36" of cooktop with 15" each side is 66", which is on the slider's 6" step.
    expect(refusal!.suggestion?.patch).toEqual({ islandLengthIn: 66 });
  });

  it("builds 66 inches, 15 and 15, and it passes every rule", () => {
    open();
    const result = setLayoutParamsGrowing({ ...REQUESTED_PARAMS, islandOrientation, islandLengthIn: 66 });
    expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
    expect(checkLayout().map((v) => `${v.code}: ${v.message}`)).toEqual([]);
  });
});
