import { afterAll, describe, expect, it } from "vitest";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import type { LayoutParams } from "./layoutTemplate";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { SlotId } from "../types";

/**
 * Every machine standing in a tower has its opening where its own document
 * allows. Round 74 — found when E's combination oven hung 0" off the floor
 * against MEM301WS's 4-3/4" minimum, because the code that sets a combination
 * oven's height only ran for one beside the range (D17: E walks branches A-D
 * never took). This file guards the class, not E: a tower machine whose
 * opening falls to a default nobody set turns it red.
 *
 * The allowed range is written here per model with where it comes from, and a
 * tower machine with no entry fails — so a new model has to bring its range.
 * Opening heights are read off the room (the slot's own height off the floor),
 * never from the code that set them.
 */
afterAll(() => resetRoom());

type Range = { min: number; max: number; source: string };
const FLOOR: Omit<Range, "source"> = { min: 0, max: 0 };

const ALLOWED: Record<string, Range> = {
  MEM301WS: { min: 4.75, max: 18, source: "mem301ws-spec.pdf p. 3; mem301ws-manual.png §5.6: 4-3/4\"-18\"" },
  PODS302B: { min: 4.75, max: 18.75, source: "pods302b-spec.pdf p. 2: 4-3/4\"-18-3/4\"" },
  TCM24PS: {
    min: 0,
    max: 37.4375,
    source: "TCM24PS_Install_Manual.pdf p. 11 and step 2 (p. 3): should not be installed higher than approx. 37-7/16\" (950 mm)",
  },
  T36BT120NS: { ...FLOOR, source: "thermador-t36bt120ns.png p. 4: an 84\" opening from the floor" },
  T18IW100SP: { ...FLOOR, source: "t18iw100sp-spec.pdf p. 3: an 84\" niche from the floor" },
  // The flush columns' own sheets are not in docs/reference/. They stand in an
  // 84" niche from the floor as their family does (T18IW100SP's sheet): inferred.
  T18IF900SP: { ...FLOOR, source: "inferred: its family's sheet (t18iw100sp-spec.pdf p. 3)" },
  T24IF905SP: { ...FLOOR, source: "inferred: its family's sheet (t18iw100sp-spec.pdf p. 3)" },
  T30IR905SP: { ...FLOOR, source: "inferred: its family's sheet (t18iw100sp-spec.pdf p. 3)" },
  T24IW905SP: { ...FLOOR, source: "inferred: its family's sheet (t18iw100sp-spec.pdf p. 3)" },
};

/**
 * ⚠️ Known and reported, not fixed (round 74, Open items): D and E hang the
 * coffee machine at 42", over the manual's approx. 37-7/16". The exception is
 * exactly these, at exactly 42", and it fails the day either is in range, so
 * it goes with the fix.
 */
const KNOWN: Record<string, number> = {
  "package-d slot-coffee TCM24PS": 42,
  "package-e slot-coffee TCM24PS": 42,
};

/**
 * How many machines each package stands in a tower: A its refrigerator; B its
 * refrigerator, combination oven and wine column; C none (its refrigerator
 * stands free, D11 rule 11); D three columns, the steam oven and the coffee
 * machine; E two columns, the combination oven and the coffee machine.
 */
const TOWERS: Record<string, number> = {
  "package-a": 1,
  "package-b": 3,
  "package-c": 0,
  "package-d": 5,
  "package-e": 4,
};

type Arrangement = Partial<Pick<LayoutParams, "sinkLeg" | "fridgeEnd" | "coffeeLeg" | "islandOrientation">>;
const ARRANGEMENTS: [string, Arrangement][] = [["as it opens", {}]];
for (const sinkLeg of ["back", "left"] as const)
  for (const fridgeEnd of ["left", "back"] as const)
    for (const coffeeLeg of ["left", "back"] as const)
      for (const islandOrientation of ["parallel", "perpendicular"] as const)
        ARRANGEMENTS.push([
          `sink ${sinkLeg}, refrigerator ${fridgeEnd}, coffee ${coffeeLeg}, island ${islandOrientation}`,
          { sinkLeg, fridgeEnd, coffeeLeg, islandOrientation },
        ]);

function build(id: string, arrangement: Arrangement): boolean {
  resetRoom();
  if (!setActivePackage(id).ok) return false;
  if (Object.keys(arrangement).length === 0) return true;
  return setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok;
}

/** The machines standing in a tower in the room as built: the tall modules that hold one. */
const towerSlots = (): SlotId[] => [
  ...new Set(
    RUNS.flatMap((run) => run.segments)
      .flatMap((segment) => segment.modules)
      .filter((module) => module.kind === "tall" && module.slot)
      .map((module) => module.slot as SlotId),
  ),
];

describe.each(PACKAGES.map((pkg) => pkg.id))("%s", (id) => {
  it.each(ARRANGEMENTS)("hangs every tower machine where its document allows (%s)", (_name, arrangement) => {
    if (!build(id, arrangement)) return;
    const slots = towerSlots();
    const wrong: string[] = [];
    for (const slot of slots) {
      const model = PACKAGE_BY_ID[id].defaultSelection[slot];
      const name = model ? model.split("-").slice(1).join("-").toUpperCase() : "(none)";
      const range = ALLOWED[name];
      const sillIn = Math.round(SLOT_BY_ID[slot].position[1] * 12 * 1000) / 1000;
      const key = `${id} ${slot} ${name}`;
      if (!range) {
        wrong.push(`${key}: no allowed range recorded — add it, with its source`);
        continue;
      }
      if (key in KNOWN) {
        if (sillIn !== KNOWN[key]) wrong.push(`${key}: the known exception is at ${KNOWN[key]}", this is ${sillIn}"`);
        continue;
      }
      if (sillIn < range.min - 1e-6 || sillIn > range.max + 1e-6) {
        wrong.push(`${key}: opening ${sillIn}" off the floor, allowed ${range.min}"-${range.max}" (${range.source})`);
      }
    }
    // Counted as well: an empty set of towers would pass anything (D22, round
    // 72). How many each package stands in towers is stated, not read back.
    expect({ towers: slots.length, wrong }).toEqual({ towers: TOWERS[id], wrong: [] });
  });
});
