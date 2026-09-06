import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID, SCHEME, selectionFor } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { RULES, ductDiameterFor, evaluateSlot, packageContext } from "./rules";
import { slotAvailability } from "./availability";
import type { Appliance, SlotId } from "../types";

const slot = (id: SlotId) => SLOT_BY_ID[id];
const model = (id: string) => APPLIANCE_BY_ID[id];

/** Fire the slot-scope rules for one appliance, with no blower in play. */
const fire = (slotId: SlotId, appliance: Appliance, blower: Appliance | null = null) =>
  evaluateSlot(slot(slotId), appliance, packageContext(undefined, blower)).map(
    (finding) => finding.ruleId,
  );

/** Fire the package-scope rules for a hood and blower pairing. */
const firePackage = (hood: Appliance, blower: Appliance | null) =>
  evaluateSlot(slot("slot-hood"), hood, packageContext(hood, blower), "package").map(
    (finding) => finding.ruleId,
  );

describe("the rules file", () => {
  it("gives every rule a unique id", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it("has a message for every rule", () => {
    for (const rule of RULES) expect(rule.messageKey, rule.id).toMatch(/^rule\./);
  });
});

// Each of these is a real model from the catalogue, one that fires the rule and
// one that does not, so a threshold change shows up as a failing test.
describe("§3.5.4 rules", () => {
  it("power-upgrade: induction in a 120V slot, but not a gas range", () => {
    expect(fire("slot-range", model("cafe-chs900p2ms1"))).toContain("power-upgrade");
    expect(fire("slot-range", model("thermador-prg366wh"))).not.toContain("power-upgrade");
  });

  it("dual-fuel: the Pro Grand, but not the Pro Harmony", () => {
    expect(fire("slot-range", model("thermador-prd486wdhu"))).toContain("dual-fuel");
    expect(fire("slot-range", model("thermador-prg366wh"))).not.toContain("dual-fuel");
  });

  it("gas-pipe-size: 119,500 BTU wants 3/4\", 61,000 does not", () => {
    const big = model("thermador-prg366wh");
    expect(big.requires.gasBTU).toBe(119500);
    expect(fire("slot-range", big)).toContain("gas-pipe-size");

    const small = { ...big, requires: { ...big.requires, gasBTU: 61000 } };
    expect(fire("slot-range", small)).not.toContain("gas-pipe-size");
  });

  it("gas-line-missing: a gas appliance in a slot with no gas", () => {
    const gasRange = model("thermador-prg366wh");
    // The wine slot has no gas rough-in at all.
    expect(fire("slot-wine", gasRange)).toContain("gas-line-missing");
    expect(fire("slot-range", gasRange)).not.toContain("gas-line-missing");
  });

  it("blower-missing: a hood that ships without one, until one is chosen", () => {
    const needsBlower = model("thermador-ph36hws");
    expect(fire("slot-hood", needsBlower, null)).toContain("blower-missing");
    expect(fire("slot-hood", needsBlower, model("thermador-vtn2fz"))).not.toContain(
      "blower-missing",
    );
    // A hood with its own blower never asks.
    expect(fire("slot-hood", model("zephyr-zsa-e36cs"), null)).not.toContain("blower-missing");
  });

  it("makeup-air: 600 CFM triggers it, 300 does not", () => {
    const separate = model("thermador-ph36hws");
    expect(firePackage(separate, model("thermador-vtn2fz"))).toContain("makeup-air");
    expect(firePackage(model("vent-a-hood-prh9-136ss"), null)).not.toContain("makeup-air");
  });

  it("integrated-lead-time: an integrated fridge, but not a built-in one", () => {
    const integrated = {
      ...model("thermador-t36bt120ns"),
      installType: ["integrated"],
    } as Appliance;
    expect(fire("slot-fridge", integrated)).toContain("integrated-lead-time");
    expect(fire("slot-fridge", model("thermador-t36bt120ns"))).not.toContain(
      "integrated-lead-time",
    );
  });

  it("filler-needed: a 30\" range in a 36\" opening, but not a 36\" one", () => {
    expect(fire("slot-range", model("cafe-chs900p2ms1"))).toContain("filler-needed");
    expect(fire("slot-range", model("thermador-prg366wh"))).not.toContain("filler-needed");
  });

  it("deeper-than-opening: the counter-depth Bosch, but not the built-ins", () => {
    expect(fire("slot-fridge", model("bosch-b36cl80sns"))).toContain("deeper-than-opening");
    expect(fire("slot-fridge", model("thermador-t36bt120ns"))).not.toContain(
      "deeper-than-opening",
    );
  });

  it("reports the numbers the message needs", () => {
    const findings = evaluateSlot(
      slot("slot-range"),
      model("cafe-chs900p2ms1"),
      packageContext(undefined, null),
    );
    const power = findings.find((f) => f.ruleId === "power-upgrade");
    expect(power?.params).toEqual({ voltage: 240, amps: 40 });
    const filler = findings.find((f) => f.ruleId === "filler-needed");
    expect(filler?.params.filler).toBe(3);
  });
});

describe("duct sizing comes from the thresholds table", () => {
  it.each([
    [300, 6],
    [400, 6],
    [401, 8],
    [600, 8],
    [601, 10],
    [1300, 10],
  ])("%s CFM wants %s inches", (cfm, expected) => {
    expect(ductDiameterFor(cfm)).toBe(expected);
  });

  it("has no opinion with no airflow", () => {
    expect(ductDiameterFor(null)).toBeNull();
  });
});

describe("the default package", () => {
  it("has no blockers", () => {
    const selection = selectionFor(SCHEME);
    const blower = SCHEME.defaultBlower ? model(SCHEME.defaultBlower) : null;
    const context = packageContext(selection["slot-hood"], blower);
    const findings = [
      ...Object.entries(selection).flatMap(([slotId, appliance]) =>
        evaluateSlot(slot(slotId as SlotId), appliance, context),
      ),
      ...evaluateSlot(slot("slot-hood"), selection["slot-hood"], context, "package"),
    ];
    expect(findings.filter((f) => f.severity === "blocker")).toEqual([]);
  });
});

describe("slot availability", () => {
  const otr = {
    ...model("thermador-md24bs"),
    installType: ["otr"],
  } as Appliance;

  it("closes the hood slot when an over-the-range microwave takes the wall", () => {
    const availability = slotAvailability({ "slot-microwave": otr });
    expect(availability["slot-hood"]?.available).toBe(false);
    expect(availability["slot-hood"]?.takenBy).toContain("MD24BS");
  });

  it("leaves it open for a drawer microwave", () => {
    const availability = slotAvailability({
      "slot-microwave": model("thermador-md24bs"),
    });
    expect(availability["slot-hood"]).toBeUndefined();
  });

  // Scheme 01 cannot reach this state: the island opening is 24" and every OTR
  // is 30", so the fit check blocks it first. The rule is here for Scheme 02,
  // where the microwave goes back over the range.
  it("is unreachable in Scheme 01, because no OTR fits the island", () => {
    const microwaveSlot = slot("slot-microwave");
    expect(microwaveSlot.cutout.w).toBe(24);
  });
});
