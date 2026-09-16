import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { checklistFor } from "./useChecklist";
import { setActivePackage } from "./layoutState";
import { resetRoom } from "./testRoom";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, Package, SlotId } from "../types";

/**
 * Every line on the install checklist names a machine this room has. Round 55.
 *
 * The panel groups its findings by slot and looks each one up by name, so a
 * line filed under a machine the package does not contain is not a wrong label
 * — it is `undefined.labelKey`, and it takes the whole right-hand column down
 * with it. Package E found it: the COMBIKIT line between two refrigeration
 * columns was filed under `slot-wine` outright, because in package D the bank
 * happens to end with a wine column. E's bank is a freezer and a refrigerator.
 *
 * So the rule is the producer's, not the panel's: **a rule does not report
 * against a slot the package has not declared.** Held here over every package,
 * including one built to E's shape, because the packages that ship all happen
 * to contain the slots their rules name and would never show it.
 */

const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;
const E_ID = "test-checklist-island-cooking";

/** Package E's shape: cooking on the island, two columns, no wine and no range. */
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
      // A cooktop island's aisle, since round 56, and D20's 24" island.
      aisleIn: 48,
      islandOverhangIn: 15,
      islandDepthIn: 24,
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
      // Ducted as HMIB42WS's guide shows; an island hood may not be declared
      // up through a cabinet or out through a wall (round 58).
      { ...hood, widthIn: 42, installType: "island", builtForCooktopIn: 36, utilities: { gas: null, power: null, duct: { diameterIn: 8, route: "through-ceiling" } } },
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

/** The findings for a package, once it is the room. */
function findingsFor(id: string) {
  resetRoom();
  const active = setActivePackage(id);
  expect(active.ok, `${id}: ${JSON.stringify(active)}`).toBe(true);
  const selection = Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[id].defaultSelection).map(([slot, applianceId]) => [
      slot,
      CATALOGUE.find((entry) => entry.id === applianceId)!,
    ]),
  ) as Record<SlotId, Appliance>;
  const blower = PACKAGE_BY_ID[id].defaultBlower
    ? (CATALOGUE.find((entry) => entry.id === PACKAGE_BY_ID[id].defaultBlower) ?? null)
    : null;
  return { findings: checklistFor(selection, blower).findings, pkg: PACKAGE_BY_ID[id] };
}

describe.each(PACKAGES.map((pkg) => pkg.id))("%s reports only on its own machines", (id) => {
  it("names no slot the package has not declared", () => {
    const { findings, pkg } = findingsFor(id);
    const declared = new Set(pkg.slots.map((slot) => slot.slotId));
    const strays = findings
      .filter((finding) => finding.slot && !declared.has(finding.slot))
      .map((finding) => `${finding.ruleId} -> ${finding.slot}`);
    expect(strays, strays.join("\n")).toEqual([]);
  });

  it("names no slot the panel could not look up", () => {
    const { findings } = findingsFor(id);
    const strays = findings
      .filter((finding) => finding.slot && !SLOT_BY_ID[finding.slot])
      .map((finding) => `${finding.ruleId} -> ${finding.slot}`);
    expect(strays, strays.join("\n")).toEqual([]);
  });
});

describe("a package whose columns are a freezer and a refrigerator", () => {
  it("still lists the kit between them, under one of them", () => {
    PACKAGE_BY_ID[E_ID] = packageE();
    const { findings } = findingsFor(E_ID);
    const kit = findings.find((finding) => finding.ruleId === "column-kit");
    expect(kit, "the COMBIKIT line is still reported").toBeTruthy();
    expect(["slot-freezer", "slot-fridge"]).toContain(kit!.slot);
  });

  it("names nothing the room does not contain", () => {
    PACKAGE_BY_ID[E_ID] = packageE();
    const { findings, pkg } = findingsFor(E_ID);
    const declared = new Set(pkg.slots.map((slot) => slot.slotId));
    const strays = findings
      .filter((finding) => finding.slot && !declared.has(finding.slot))
      .map((finding) => `${finding.ruleId} -> ${finding.slot}`);
    expect(strays, strays.join("\n")).toEqual([]);
  });
});
