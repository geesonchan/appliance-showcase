import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID, offeredFor, suitsPackageSlot } from "./catalogue";
import { billLabelKey, slotLabelKey } from "./machineLabel";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS, oneWallWantedIn, wallRequirement, type LayoutParams } from "./layoutTemplate";
import type { LayoutShape } from "./layoutShape";
import { BUILDABLE_PACKAGES, PACKAGE, PACKAGE_BY_ID, packageInShape } from "./packages";
import { REQUESTED_PARAMS } from "./room";
import { resetRoom } from "./testRoom";
import * as testRoom from "./testRoom";
import * as packages from "./packages";
import * as layoutState from "./layoutState";
import * as roomState from "./room";
import * as candidates from "./candidates";
import * as catalogue from "./catalogue";
import * as layoutTemplate from "./layoutTemplate";
import { lRooms, oneWallRooms } from "./roomSets";
import { checklistFor } from "./useChecklist";
import { modelFieldsOf, noticeItemKey } from "../store/shareLink";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import type { Appliance, Package, SlotId } from "../types";

/**
 * Round 99, the L's labels (docs/plans/round-99-plan.md; Leo: "标签跟着选中的机器走，
 * 按类别和安装方式取词，所有显示的地方都经同一个函数。测试按每一个能换的型号比对").
 *
 * What a word means, written here on its own rather than read from the code
 * that chooses it, so a word put on the wrong machine is caught: B's and E's
 * combination oven was called "Microwave" for as long as it existed.
 */

afterAll(() => resetRoom());

/** What a machine is, by its category and how it installs. */
function machineIs(appliance: Appliance): string {
  const has = (type: string) => appliance.installType.includes(type as never);
  switch (appliance.category) {
    case "wall-oven":
      return has("combo") ? "combination oven" : has("steam") ? "steam oven" : has("double") ? "double oven" : "single oven";
    case "range":
      return has("rangetop") ? "rangetop" : "range";
    case "microwave":
      return "microwave drawer";
    case "otr":
      return "over-the-range microwave";
    case "wine":
      return has("column") ? "wine column" : "wine";
    default:
      return appliance.category;
  }
}

/** What each slot label says the machine is. */
const LABEL_SAYS: Record<string, string> = {
  "slot.fridge": "refrigerator",
  "slot.freezer": "freezer",
  "slot.wine": "wine",
  "slot.wine2": "wine",
  "slot.wineColumn": "wine column",
  "slot.dishwasher": "dishwasher",
  "slot.dishwasher2": "dishwasher",
  "slot.coffee": "coffee",
  "slot.cooktop": "cooktop",
  "slot.hood": "hood",
  "slot.otr": "over-the-range microwave",
  "slot.range": "range",
  "slot.rangetop": "rangetop",
  "slot.microwave": "microwave drawer",
  "slot.comboOven": "combination oven",
  "slot.oven": "steam oven",
  "slot.doubleOven": "double oven",
  "slot.singleOven": "single oven",
};

/** What each word on a wall's bill says stands there, where it names a machine. */
const BILL_SAYS: Record<string, string> = {
  "requirement.fridge": "refrigerator",
  "requirement.fridgeColumn": "refrigerator column",
  "requirement.wineColumn": "wine column",
  "requirement.freezer": "freezer",
  "requirement.wine": "wine",
  "requirement.dishwasher": "dishwasher",
  "requirement.range": "range",
  "requirement.rangetop": "rangetop",
  "requirement.microwave": "microwave drawer",
  "requirement.comboOven": "combination oven",
  "requirement.oven": "steam oven",
  "requirement.doubleOven": "double oven",
  "requirement.singleOven": "single oven",
  "requirement.cooktop": "cooktop",
  "requirement.coffee": "coffee over dishwasher",
  "requirement.coffeeOverWine": "coffee over wine",
  "requirement.coffeeOverCabinet": "coffee over cabinet",
};

/** A filler's words, and a finished panel's: neither is a cabinet. */
const FILLER_WORDS = ["requirement.wall-end"];
const PANEL_WORDS = [
  "requirement.tall-inner",
  "requirement.tall-outer",
  "requirement.coffee-panel-start",
  "requirement.coffee-panel-end",
  "requirement.tower-panel",
  "requirement.endPanel",
];

const SHAPES: LayoutShape[] = ["L", "one-wall"];

/** A package's room in a shape, at the walls it asks for there. */
function room(entry: Package, shape: LayoutShape, patch: Partial<LayoutParams> = {}) {
  resetRoom();
  if (!setActivePackage(entry.id).ok) throw new Error(`${entry.code} will not build`);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, ...patch, shape };
  if (shape === "one-wall") asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, entry));
  return setLayoutParamsGrowing(asked);
}

/** The models a slot can hold in this package and shape: its own, and every one offered that goes in. */
function modelsFor(shaped: Package, slotId: SlotId): Appliance[] {
  const slot = shaped.slots.find((candidate) => candidate.slotId === slotId)!;
  const offered = offeredFor(slotId, slot).filter((appliance) => suitsPackageSlot(appliance, slot, shaped));
  return [...new Set([APPLIANCE_BY_ID[shaped.defaultSelection[slotId]!], ...offered])];
}

const defaults = (shaped: Package) =>
  Object.fromEntries(shaped.slots.map((slot) => [slot.slotId, APPLIANCE_BY_ID[shaped.defaultSelection[slot.slotId]!]])) as Record<SlotId, Appliance>;

describe("a machine is called what it is, wherever it is named (round 99)", () => {
  it("names every model each slot can hold, in all five packages and both shapes, by what the model is", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      for (const shape of SHAPES) {
        room(entry, shape);
        for (const slot of PACKAGE.slots) {
          for (const appliance of modelsFor(PACKAGE, slot.slotId)) {
            checked++;
            const key = slotLabelKey(slot.slotId, appliance);
            if (LABEL_SAYS[key] !== machineIs(appliance)) wrong.push(`${entry.code} ${shape} ${slot.slotId} ${appliance.model}: ${key}, which says ${LABEL_SAYS[key] ?? "nothing known"}, for a ${machineIs(appliance)}`);
          }
        }
      }
    }
    expect({ checked, wrong }).toEqual({ checked: 107, wrong: [] });
  });

  it("names the same machine in a share link's notice as on the page", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      for (const shape of SHAPES) {
        room(entry, shape);
        for (const field of modelFieldsOf(entry.id, shape)) {
          for (const appliance of modelsFor(PACKAGE, field.slotId)) {
            checked++;
            const notice = noticeItemKey(field.name, appliance.id);
            const page = slotLabelKey(field.slotId, appliance);
            if (notice !== page) wrong.push(`${entry.code} ${shape} ${field.name}=${appliance.model}: the notice says ${notice}, the page ${page}`);
          }
        }
      }
    }
    expect({ checked, wrong }).toEqual({ checked: 107, wrong: [] });
  });
});

describe("a wall's bill names what stands on it (round 99)", () => {
  /** Every arrangement a bill's words can differ in: the refrigerator's end and what it abuts, the island, the coffee cabinet's leg. */
  const arrangements = (shape: LayoutShape): Partial<LayoutParams>[] =>
    shape === "one-wall"
      ? [{}]
      : (["left", "back"] as const).flatMap((fridgeEnd) =>
          [true, false].flatMap((hasIsland) =>
            (["left", "back"] as const).flatMap((coffeeLeg) =>
              (["cabinet", "wall"] as const).map((fridgeEndAbuts) => ({ fridgeEnd, hasIsland, coffeeLeg, fridgeEndAbuts })),
            ),
          ),
        );

  function bills() {
    const out: { where: string; item: ReturnType<typeof wallRequirement>["items"][number]; shaped: Package }[] = [];
    for (const entry of BUILDABLE_PACKAGES) {
      for (const shape of SHAPES) {
        const shaped = packageInShape(entry, shape);
        for (const patch of arrangements(shape)) {
          const asked: LayoutParams = { ...DEFAULT_PARAMS, ...entry.defaultLayout, ...patch, shape };
          for (const leg of ["back", "left"] as const) {
            for (const item of wallRequirement(asked, leg, PACKAGE_BY_ID[entry.id]).items) {
              out.push({ where: `${entry.code} ${shape} ${JSON.stringify(patch)} ${leg}`, item, shaped });
            }
          }
        }
      }
    }
    return out;
  }

  it("calls each machine on a wall what it is, for every model that slot can hold", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const { where, item, shaped } of bills()) {
      if (!item.slot) continue;
      const coffee = shaped.slots.find((slot) => slot.slotId === item.slot)!;
      for (const appliance of modelsFor(shaped, item.slot)) {
        checked++;
        const key = billLabelKey(item, { ...defaults(shaped), [item.slot]: appliance });
        const under = shaped.slots.find((slot) => slot.slotId === coffee.standsOver)?.category;
        const is =
          appliance.category === "coffee"
            ? `coffee over ${under === "dishwasher" || under === "wine" ? under : "cabinet"}`
            : appliance.category === "refrigerator" && appliance.installType.includes("column" as never)
              ? "refrigerator column"
              : machineIs(appliance);
        if (BILL_SAYS[key] !== is) wrong.push(`${where} ${item.code} ${appliance.model}: ${key}, which says ${BILL_SAYS[key] ?? "nothing known"}, for ${is}`);
      }
    }
    expect({ checked, wrong: [...new Set(wrong)] }).toEqual({ checked: 678, wrong: [] });
  });

  it("calls a filler a filler and a panel a panel", () => {
    const wrong = new Set<string>();
    let checked = 0;
    for (const { where, item, shaped } of bills()) {
      const key = billLabelKey(item, defaults(shaped));
      if (/^BF[\d.]+$/.test(item.code ?? "")) {
        checked++;
        if (!FILLER_WORDS.includes(key)) wrong.add(`${where.split(" {")[0]} ${item.code}: ${key}`);
      }
      if (/^PNL[\d.]+$/.test(item.code ?? "")) {
        checked++;
        if (!PANEL_WORDS.includes(key)) wrong.add(`${where.split(" {")[0]} ${item.code}: ${key}`);
      }
    }
    expect({ checked, wrong: [...wrong] }).toEqual({ checked: 271, wrong: [] });
  });

  it("has every word on every bill in both languages, in all 1,045 L rooms and 91 one-wall rooms", () => {
    // Round 99a (Leo: "改成跑在 L 型 1,045 个房间和一字型 91 个房间的底稿上"): the rooms
    // the two dumps build, `roomSets.ts`, not one short one-wall room — on
    // which the board between the microwave drawer and the wine cooler never
    // stood, and so never showed it had no words.
    const modules = { packages, layoutState, room: roomState, candidates, catalogue, testRoom, layoutTemplate };
    const missing = new Set<string>();
    const counted = { built: 0, refused: 0 };
    for (const set of [lRooms(modules), oneWallRooms(modules)]) {
      for (const c of set) {
        const result = c.build() as { ok: boolean; reasons?: unknown };
        const items = result.ok
          ? (["back", "left"] as const).flatMap((leg) => roomState.wallRequirement(roomState.LAYOUT_PARAMS, leg, c.pkg).items)
          : (Array.isArray(result.reasons) ? result.reasons : []).flatMap((reason: { occupancy?: unknown[] }) => reason.occupancy ?? []);
        counted[result.ok ? "built" : "refused"]++;
        for (const item of items) {
          const key = billLabelKey(item as Parameters<typeof billLabelKey>[0], c.selection());
          for (const [lang, words] of [["en", en], ["zh", zh]] as const) {
            if (!(key in words)) missing.add(`${lang} ${key}`);
          }
        }
      }
    }
    expect({ counted, missing: [...missing] }).toEqual({ counted: { built: 606, refused: 530 }, missing: [] });
  });
});

describe("the no-island line on where the microwave drawer and the wine cabinet stand (round 99)", () => {
  it("is said only of a package with a microwave drawer and a wine cabinet of its own, A and C", () => {
    // Walls long enough to stand both on them rather than leave them out, with
    // the refrigerator at either end: whether any room of the package says it.
    const says = Object.fromEntries(
      BUILDABLE_PACKAGES.map((entry) => [
        entry.code,
        (["left", "back"] as const).some((fridgeEnd) => {
          room(entry, "L", { hasIsland: false, fridgeEnd, backWallIn: 216, leftWallIn: 216 });
          return checklistFor(defaults(PACKAGE), null).findings.some((finding) => finding.messageKey === "rule.noIslandFallback");
        }),
      ]),
    );
    expect(says).toEqual({ A: true, B: false, C: true, D: false, E: false });
  });

  it("and on one wall, its own line on where the two stand, likewise only A and C", () => {
    const says = Object.fromEntries(
      BUILDABLE_PACKAGES.map((entry) => {
        room(entry, "one-wall");
        return [entry.code, checklistFor(defaults(PACKAGE), null).findings.some((finding) => finding.messageKey === "rule.oneWallSpares")];
      }),
    );
    expect(says).toEqual({ A: true, B: false, C: true, D: false, E: false });
  });
});
