import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { TIER_ORDER, listRoughIn, roughInCallout } from "./roughInList";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import type { Appliance, SlotId } from "../types";

/**
 * The panel's list of rough-in points (round 42): the same points the room
 * draws, grouped by tier, each with the callout a click would show — so a point
 * can be reached when an appliance stands in front of it.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

const selectionOf = (id: string) =>
  Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[id].defaultSelection).map(([slot, applianceId]) => [
      slot,
      APPLIANCE_BY_ID[applianceId as string],
    ]),
  ) as Partial<Record<SlotId, Appliance>>;

const activate = (id: string) => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  expect(setActivePackage(id).ok).toBe(true);
};

describe("the rough-in list", () => {
  it("lists every point package A draws, one each, grouped by tier", () => {
    activate("package-a");
    const items = listRoughIn(selectionOf("package-a"));
    const count = Object.fromEntries(TIER_ORDER.map((tier) => [tier, items.filter((i) => i.tier === tier).length]));
    // Nine to confirm since round 73: PRW24C01CG's socket, in the island
    // cabinet beside the wine cabinet, is inferred.
    expect(count).toEqual({ confirmed: 1, unconfirmed: 9, unreviewed: 1 });
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(items.find((i) => i.resolved.point.type === "anti-tip")?.tier).toBe("confirmed");
  });

  it("gives every item the callout a click would, in both languages", () => {
    activate("package-a");
    for (const item of listRoughIn(selectionOf("package-a"))) {
      const callout = roughInCallout(item);
      expect((en as Record<string, string>)[callout.key], callout.key).toBeTruthy();
      expect((zh as Record<string, string>)[callout.key], callout.key).toBeTruthy();
      // Round 70: the callout names its words by key; each part is in both.
      for (const name of ["typeKey", "whereKey", "atKey"] as const) {
        expect((en as Record<string, string>)[callout.vars[name]], `${item.key} ${name}`).toBeTruthy();
        expect((zh as Record<string, string>)[callout.vars[name]], `${item.key} ${name}`).toBeTruthy();
      }
    }
  });

  it("names every tier and the generic runs, in both languages", () => {
    const keys = [...TIER_ORDER.map((tier) => `roughIn.tier.${tier}`), "panel.roughIn", "roughIn.generic", "roughIn.none"];
    for (const key of keys) {
      expect((en as Record<string, string>)[key], key).toBeTruthy();
      expect((zh as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
