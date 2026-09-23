import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import type { LayoutParams } from "./layoutTemplate";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS } from "./room";
import round69 from "./roughInEnglish.round69.json";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import type { Appliance, SlotId } from "../types";

/**
 * Moving the rough-in sentences into the dictionary changed no English word
 * (round 70).
 *
 * `roughInEnglish.round69.json` is every English rough-in line the checklist
 * printed on round 69's code, for every package in every arrangement it builds
 * — generated from that code, not typed. Each line must come out the same now,
 * rendered the way the page renders it.
 *
 * ⚠️ The exception, and why: round 70's geometry fix changed 38 of those lines
 * on purpose — the cabinet beside a tower said "from the left side" where the
 * figure is from its right, package A's refrigerator named a cabinet on the
 * wrong side, and a neighbour's figure is now from the side that meets the
 * machine. They are listed in the file under `changedInRound70` with what each
 * said, what it says now and why, and are held to the new words instead. Any
 * other difference is a change the translation made to the English.
 */
afterAll(() => {
  resetRoom();
});

type Changed = Record<string, { was: string; now: string; why: string }>;
const WAS = round69.round69 as Record<string, string>;
// Each round that changes a line on purpose adds its own layer, with what the
// line said, what it says now and why. The last layer that names a line wins.
const LAYERS: Changed[] = [round69.changedInRound70 as Changed, round69.changedInRound71 as Changed];
const CHANGED: Changed = Object.assign({}, ...LAYERS);
/** Lines that did not exist in round 69, with what they say and why. */
const ADDED = round69.addedInRound72 as Record<string, { now: string; why: string }>;

const en = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);

type Arrangement = Partial<Pick<LayoutParams, "sinkLeg" | "fridgeEnd" | "coffeeLeg" | "islandOrientation">>;
const ARRANGEMENTS: [string, Arrangement][] = [["as-it-opens", {}]];
for (const sinkLeg of ["back", "left"] as const)
  for (const fridgeEnd of ["left", "back"] as const)
    for (const coffeeLeg of ["left", "back"] as const)
      for (const islandOrientation of ["parallel", "perpendicular"] as const)
        ARRANGEMENTS.push([
          `${sinkLeg}/${fridgeEnd}/${coffeeLeg}/${islandOrientation}`,
          { sinkLeg, fridgeEnd, coffeeLeg, islandOrientation },
        ]);

/** Every English rough-in line a package prints, keyed as the file keys them. */
function linesOf(id: string): Map<string, string> {
  const pkg = PACKAGE_BY_ID[id];
  const selection = Object.fromEntries(
    Object.entries(pkg.defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model as string]]),
  ) as Record<SlotId, Appliance>;
  const lines = new Map<string, string>();
  for (const [tag, arrangement] of ARRANGEMENTS) {
    resetRoom();
    if (!setActivePackage(id).ok) continue;
    if (tag !== "as-it-opens" && !setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok) continue;
    for (const f of checklistFor(selection, null).findings) {
      if (f.messageKey !== "rule.roughIn") continue;
      lines.set(`${id} | ${tag} | ${f.ruleId}`, sayWith(en, f.messageKey, f.params));
    }
  }
  return lines;
}

describe.each(PACKAGES.map((pkg) => pkg.id))("%s's English rough-in lines", (id) => {
  it("are word for word what round 69 printed, but for the lines round 70 changed on purpose", () => {
    const now = linesOf(id);
    const wrong: string[] = [];
    for (const [key, was] of Object.entries(WAS)) {
      if (!key.startsWith(`${id} |`)) continue;
      const want = CHANGED[key]?.now ?? was;
      const got = now.get(key);
      if (got !== want) wrong.push(`${key}\n    want: ${want}\n    got:  ${got ?? "(no such line)"}`);
    }
    for (const [key, line] of now) {
      if (key in WAS) continue;
      // A line round 69 did not print at all: a model that had no rough-in
      // entry then. Each is recorded with what it says and why it is there.
      const added = ADDED[key];
      if (!added) wrong.push(`${key}: a line round 69 did not print, and it is not in the record of added lines`);
      else if (added.now !== line) wrong.push(`${key}\n    want: ${added.now}\n    got:  ${line}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });
});

describe("the line round 70 adds", () => {
  // Round 70, Leo: the checklist and the quote now open with which way left is
  // seen from. It is a line of its own, not a rough-in line and not a change to
  // one, so it is not in the round-69 record; it is held here, word for word.
  it("says which way left is, as a new line of its own", () => {
    const note = translate("en", "roughIn.sidesNote");
    const inRecord = Object.values(WAS).some((line) => line.includes(note));
    expect({ note, inRecord }).toEqual({ note: "Left and right are as you face the cabinet.", inRecord: false });
  });
});

describe("the round-69 record", () => {
  it("lists a reason for every line a later round changed", () => {
    // Each layer's `was` is what the line said before that layer: round 69's
    // text for the first, and the previous layer's `now` where it names it.
    const bare: string[] = [];
    let before: Record<string, string> = { ...WAS };
    for (const layer of LAYERS) {
      for (const [key, change] of Object.entries(layer)) {
        if (!(key in before) || change.was !== before[key] || !change.why) bare.push(key);
        before[key] = change.now;
      }
    }
    expect(bare).toEqual([]);
  });
});
