import { describe, expect, it } from "vitest";
import { buildQuote, formatQuote } from "./quote";
import { FIXTURES } from "./testFixtures";
import { SLOTS, SLOT_BY_ID } from "./slots";
import { evaluateSlot, packageContext } from "./rules";
import { translate } from "../i18n";
import type { Appliance, SlotId } from "../types";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);

const selection = (): Partial<Record<SlotId, Appliance>> => ({
  "slot-fridge": FIXTURES.fridgeBuiltIn,
  "slot-range": FIXTURES.gasRange36,
  "slot-hood": FIXTURES.hoodNeedsBlower,
  "slot-dishwasher": FIXTURES.dishwasher,
  "slot-microwave": FIXTURES.microwaveDrawer,
  "slot-wine": FIXTURES.wine,
});

function quoteOf(
  overrides: Partial<Record<SlotId, Appliance>> = {},
  blower: Appliance | null = FIXTURES.blower600,
) {
  const picked = { ...selection(), ...overrides };
  const hood = picked["slot-hood"]!;
  const context = packageContext(hood, blower);
  const findings = [
    ...SLOTS.flatMap((slot) => evaluateSlot(slot, picked[slot.id], context)),
    ...evaluateSlot(SLOT_BY_ID["slot-hood"], hood, context, "package"),
  ];
  return buildQuote({
    packageId: "test",
    packageName: "Test package",
    slots: SLOTS,
    selection: picked,
    blower,
    hoodNeedsBlower: hood.blower === "required",
    findings,
    t,
  });
}

describe("quote", () => {
  it("carries one line per slot, in slot order", () => {
    const quote = quoteOf();
    expect(quote.lines.map((line) => line.slot)).toEqual(SLOTS.map((slot) => slot.id));
  });

  it("keeps the blower on its own line rather than folding it into the hood", () => {
    const quote = quoteOf();
    expect(quote.blower?.applianceId).toBe(FIXTURES.blower600.id);
    expect(quote.lines.some((line) => line.applianceId === FIXTURES.blower600.id)).toBe(false);
    // The blower still counts toward the package.
    expect(quote.totals.itemCount).toBe(SLOTS.length + 1);
  });

  it("drops the blower line when the hood has its own", () => {
    const quote = quoteOf({ "slot-hood": FIXTURES.hoodIntegrated600 }, FIXTURES.blower1300);
    expect(quote.blower).toBeNull();
    expect(quote.totals.itemCount).toBe(SLOTS.length);
    // ...and the CFM comes from the hood, not the blower left selected.
    expect(quote.totals.effectiveCfm).toBe(600);
  });

  // An unpriced model must not read as a free one.
  it("totals only the priced models and says how many they are", () => {
    const unpriced = { ...FIXTURES.wine, msrpUSD: null } as Appliance;
    const quote = quoteOf({ "slot-wine": unpriced });
    expect(quote.totals.pricedCount).toBe(quote.totals.itemCount - 1);
    expect(quote.totals.subtotalUSD).toBe(1000 * quote.totals.pricedCount);
    expect(formatQuote(quote, t)).toContain(t("price.onRequest"));
  });

  it("takes the longest lead time, not the sum", () => {
    const slow = { ...FIXTURES.fridgeBuiltIn, leadTimeWeeks: 16 } as Appliance;
    expect(quoteOf({ "slot-fridge": slow }).totals.leadTimeWeeks).toBe(16);
  });

  // An unpublished lead time is unknown, not zero.
  it("says nothing about lead time when the catalogue publishes none", () => {
    const undated = Object.fromEntries(
      Object.entries(selection()).map(([slot, item]) => [slot, { ...item, leadTimeWeeks: null }]),
    ) as Record<SlotId, Appliance>;
    const quote = quoteOf(undated, { ...FIXTURES.blower600, leadTimeWeeks: null } as Appliance);
    expect(quote.totals.leadTimeWeeks).toBeNull();
    expect(formatQuote(quote, t)).not.toContain(t("panel.package.lead"));
  });

  it("puts blockers before warnings, as the checklist does", () => {
    const findings = quoteOf({ "slot-range": FIXTURES.dualFuelRange48 }, null).findings;
    const severities = findings.map((f) => f.severity);
    const order = ["blocker", "warning", "info"];
    expect(severities).toEqual([...severities].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    expect(severities).toContain("blocker");
  });

  it("serialises the rough-in each appliance actually needs, not the slot's default", () => {
    const gas = quoteOf().lines.find((line) => line.slot === "slot-range");
    expect(gas?.utilities.gas).not.toBeNull();
    const electric = quoteOf({ "slot-range": FIXTURES.inductionRange30 }).lines.find(
      (line) => line.slot === "slot-range",
    );
    expect(electric?.utilities.gas).toBeNull();
    expect(electric?.utilities.power.voltage).toBe(240);
  });

  it("sizes the hood's duct from the blower actually fitted", () => {
    const hood = quoteOf({}, FIXTURES.blower1300).lines.find((line) => line.slot === "slot-hood");
    expect(hood?.utilities.duct?.diameterIn).toBe(10);
  });

  // Every line on the sheet has to be traceable to the rule that put it there.
  it("keeps the rule id beside each finding", () => {
    const quote = quoteOf({}, null); // no blower: the hood needs one
    const missing = quote.findings.find((f) => f.ruleId === "blower-missing");
    expect(missing).toBeDefined();
    expect(missing?.slot).toBe("slot-hood");
    expect(missing?.message).toBe(t("rule.blowerMissing"));
  });

  it("resolves every finding to finished copy, never a bare key", () => {
    for (const finding of quoteOf().findings) {
      expect(finding.message).not.toMatch(/^[a-z]+\.[a-zA-Z]/);
      expect(finding.message).not.toMatch(/[{}]/);
    }
  });

  it("reports the overrun on a model that does not fit", () => {
    const line = quoteOf({ "slot-range": FIXTURES.dualFuelRange48 }).lines.find(
      (l) => l.slot === "slot-range",
    );
    expect(line?.widthOverIn).toBe(12);
  });

  it("round-trips as JSON", () => {
    const quote = quoteOf();
    expect(JSON.parse(JSON.stringify(quote))).toEqual(quote);
  });
});

describe("quote summary", () => {
  it("names every appliance and the blower", () => {
    const text = formatQuote(quoteOf(), t);
    for (const line of quoteOf().lines) {
      expect(text).toContain(`${line.brand} ${line.model}`);
    }
    expect(text).toContain(FIXTURES.blower600.model);
    expect(text).toContain("600 CFM");
    // The same number in the same shape as the checklist uses.
    expect(formatQuote(quoteOf({}, FIXTURES.blower1300), t)).toContain("1,300 CFM");
  });

  it("lists the install findings under the totals", () => {
    const text = formatQuote(quoteOf({}, null), t);
    expect(text.indexOf(t("checklist.title"))).toBeGreaterThan(
      text.indexOf(t("panel.package.total")),
    );
    expect(text).toContain(t("rule.blowerMissing"));
  });

  it("leaves out the checklist heading when nothing fired", () => {
    const clean = { ...quoteOf(), findings: [] };
    expect(formatQuote(clean, t)).not.toContain(t("checklist.title"));
  });

  it("prices in whole dollars", () => {
    expect(formatQuote(quoteOf(), t)).toMatch(/\$[\d,]+\b/);
    expect(formatQuote(quoteOf(), t)).not.toMatch(/\$[\d,]+\.\d/);
  });
});
