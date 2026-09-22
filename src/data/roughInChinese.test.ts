import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage } from "./layoutState";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { buildQuote } from "./quote";
import { listRoughIn, roughInCallout } from "./roughInList";
import { SLOTS } from "./slots";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import type { Appliance, SlotId } from "../types";

/**
 * In Chinese, a rough-in line is Chinese (round 70).
 *
 * Until round 70 every line saying where a connection is — "power — in the base
 * cabinet beside the tower …, 3" from the left side, at the top" — was English
 * in the Chinese checklist, the Chinese quote and the Chinese callouts, in every
 * package: the sentence was put together in code, in English. Each line is read
 * the way its page renders it, and must hold no Latin letter at all: every word
 * of it — the kind of connection, the box, the measurement — is a phrase from
 * the dictionary. Inch figures (`3"`) are digits and a mark, and stay.
 */
afterAll(() => {
  resetRoom();
});

const zh = (key: string, vars?: Record<string, string | number>) => translate("zh", key, vars);
/**
 * ⚠️ The exception: three kinds of connection are named in English on the
 * Chinese page, and only these three. Installers on site say "air gap",
 * "anti-tip" and "service channel" in English, and a customer showing the
 * quote to one has to be able to point at the same words (Leo's call from
 * site, round 70). They are taken out before the check; any other Latin letter
 * in a Chinese rough-in line is still a failure.
 */
const SITE_ENGLISH = ["air gap", "anti-tip", "service channel"];
const LATIN = /[A-Za-z]/;
const hasEnglish = (line: string) => LATIN.test(SITE_ENGLISH.reduce((rest, word) => rest.split(word).join(""), line));

function open(id: string): Record<SlotId, Appliance> {
  resetRoom();
  expect(setActivePackage(id).ok).toBe(true);
  return Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[id].defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model as string]]),
  ) as Record<SlotId, Appliance>;
}

const roughInFindings = (selection: Record<SlotId, Appliance>) =>
  checklistFor(selection, null).findings.filter((f) => f.messageKey === "rule.roughIn");

describe.each(PACKAGES.map((pkg) => pkg.id))("%s in Chinese", (id) => {
  it("prints every rough-in line on the install checklist in Chinese", () => {
    const lines = roughInFindings(open(id)).map((f) => sayWith(zh, f.messageKey, f.params));
    const english = lines.filter(hasEnglish);
    expect(english, english.join("\n")).toEqual([]);
  });

  it("prints every rough-in line on the quote in Chinese", () => {
    const selection = open(id);
    const quote = buildQuote({
      packageId: id,
      packageName: id,
      slots: SLOTS,
      selection,
      blower: null,
      hoodNeedsBlower: false,
      findings: checklistFor(selection, null).findings,
      t: zh,
    });
    const english = quote.findings
      .filter((f) => f.ruleId.startsWith("rough-in:"))
      .map((f) => f.message)
      .filter(hasEnglish);
    expect(english, english.join("\n")).toEqual([]);
  });

  it("says every rough-in callout in Chinese", () => {
    const lines = listRoughIn(open(id)).map((item) => {
      const callout = roughInCallout(item);
      return sayWith(zh, callout.key, callout.vars);
    });
    const english = lines.filter(hasEnglish);
    expect(english, english.join("\n")).toEqual([]);
  });
});

describe("the lines checked", () => {
  it("are there to check, in every package", () => {
    const empty = PACKAGES.filter((pkg) => roughInFindings(open(pkg.id)).length === 0).map((pkg) => pkg.id);
    expect(empty).toEqual([]);
  });
});
