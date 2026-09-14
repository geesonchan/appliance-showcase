import { afterAll, describe, expect, it } from "vitest";
import packagesFile from "../../data/packages.json";
import { generateLayout, DEFAULT_PARAMS } from "./layoutTemplate";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { packageSchema } from "./schema";
import type { Package } from "../types";

const TEST_ID = "test-no-microwave-no-wine";

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  delete PACKAGE_BY_ID[TEST_ID];
});

/**
 * A package's slots are what it declares. Round 50 (D22, Leo round 49).
 *
 * The schema used to hold every available package to a fixed list — a
 * refrigerator, a hood, a dishwasher, a microwave drawer, a wine cabinet, and
 * from round 49 a range or a cooktop. Package E's island has neither a microwave
 * drawer nor a wine cabinet, so E could not be written down. Now a package names
 * its own slots and the schema asks only that each has a model; what the L
 * template cannot build without is the template's to say, loudly, when asked.
 */
const raw = (packagesFile as unknown as { packages: Record<string, unknown>[] }).packages;
const D = raw.find((entry) => entry.id === "package-d") as {
  slots: { slotId: string }[];
  defaultSelection: Record<string, string>;
  columnOrder: string[];
};

/** Package D with no microwave drawer and no wine column: neither of E's missing pair. */
function withoutMicrowaveOrWine() {
  const gone = ["slot-microwave", "slot-wine"];
  return {
    ...D,
    id: TEST_ID,
    slots: D.slots.filter((slot) => !gone.includes(slot.slotId)),
    defaultSelection: Object.fromEntries(
      Object.entries(D.defaultSelection).filter(([slot]) => !gone.includes(slot)),
    ),
    columnOrder: D.columnOrder.filter((slot) => !gone.includes(slot)),
  };
}

describe("a package's slots are the ones it declares", () => {
  it("accepts a package with no microwave drawer and no wine cabinet", () => {
    const parsed = packageSchema.safeParse(withoutMicrowaveOrWine());
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it("builds it as the room, and it passes every rule", () => {
    // Through the same door the app uses: the rules read the room's slots, so
    // the package has to be the room's package when they are asked.
    PACKAGE_BY_ID[TEST_ID] = packageSchema.parse(withoutMicrowaveOrWine()) as Package;
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    const chosen = setActivePackage(TEST_ID);
    expect(chosen.ok, JSON.stringify(chosen.reasons)).toBe(true);
    expect(checkLayout().map((problem) => `${problem.code}: ${problem.message}`)).toEqual([]);
  });

  it("still refuses a slot declared with no model in it", () => {
    const pkg = withoutMicrowaveOrWine();
    const { "slot-dishwasher": _dropped, ...selection } = pkg.defaultSelection;
    expect(packageSchema.safeParse({ ...pkg, defaultSelection: selection }).success).toBe(false);
  });

  it("has the template say what it cannot build without, by name", () => {
    const pkg = packageSchema.parse(withoutMicrowaveOrWine()) as Package;
    const noDishwasher = { ...pkg, slots: pkg.slots.filter((slot) => slot.slotId !== "slot-dishwasher") };
    expect(() => generateLayout({ ...DEFAULT_PARAMS, ...pkg.defaultLayout }, noDishwasher)).toThrow(
      /slot-dishwasher/,
    );
  });
});
