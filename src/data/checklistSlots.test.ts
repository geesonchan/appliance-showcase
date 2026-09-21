import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { checklistFor } from "./useChecklist";
import { setActivePackage } from "./layoutState";
import { resetRoom } from "./testRoom";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { SLOT_BY_ID } from "./slots";
import { testPackageE } from "./testPackageE";
import type { Appliance, SlotId } from "../types";

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
const E_ID = "test-checklist-island-cooking";
const packageE = () => testPackageE(E_ID);

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
