import { useMemo } from "react";
import { SLOT_ORDER } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { evaluateSlot, packageContext, type Finding } from "./rules";
import { resolveRoughIn, roughInSentence } from "./roughIn";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { applianceBox } from "./applianceBox";
import {
  COLUMN_DOOR_PANELS,
  COMBO_OVEN,
  comboHandleAt,
  comboSillFor,
  isColumn,
  isCombo,
} from "./columnModel";
import { CHIMNEY, chimneyParts, isChimney } from "./hood";
import { ISLAND, LAYOUT_LIMITS, LAYOUT_PARAMS, OMITTED_SLOTS, RUNS } from "./room";
import type { Appliance, SlotId } from "../types";

export interface Checklist {
  findings: Finding[];
  blockers: number;
  warnings: number;
}

/**
 * Every rule that fires against the package as currently specified.
 *
 * This is also the shape the quote sheet serialises: each finding carries the
 * rule that produced it and the slot it is about, so a line on the quote can be
 * traced back to why it is there.
 */
export function useChecklist(): Checklist {
  const selection = useSelection();
  const blower = useSelectedBlower();

  return useMemo(() => {
    const context = packageContext(selection["slot-hood"], blower, selection["slot-range"]);
    const findings = [
      ...SLOT_ORDER.flatMap((slotId) =>
        evaluateSlot(SLOT_BY_ID[slotId], selection[slotId], context),
      ),
      // One line per connection the model's own drawing calls for. These are
      // not rules — nothing decides whether they fire — they are the numbers
      // an installer repeats back.
      ...SLOT_ORDER.flatMap((slotId) =>
        resolveRoughIn(slotId, selection[slotId]).map((resolved, i) => ({
          ruleId: `rough-in:${slotId}:${resolved.point.type}:${i}`,
          severity: "info" as const,
          messageKey: "rule.roughIn",
          slot: slotId,
          params: {
            type: resolved.point.type,
            ...roughInSentence(resolved.point),
          },
        })),
      ),
      // Package-wide findings are attributed to the hood, which is what they
      // are actually about.
      ...evaluateSlot(SLOT_BY_ID["slot-hood"], selection["slot-hood"], context, "package"),
      // Parts the room needs that no rule decides: a chimney that will not
      // reach this ceiling on its own takes an extension, and the number is
      // the room's rather than the model's.
      ...installParts(selection),
    ];
    return {
      findings,
      blockers: findings.filter((f) => f.severity === "blocker").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
    };
  }, [selection, blower]);
}

/**
 * Accessories this room needs, as against this package.
 *
 * A chimney hood's duct cover covers a range of ceiling heights and no more.
 * A taller room needs the manufacturer's extension, and the install list is
 * where that belongs: it is not a rule anybody can fail, it is a part somebody
 * has to order.
 */
function installParts(selection: Record<SlotId, Appliance>): Finding[] {
  return [
    ...noIslandFallback(),
    ...fridgeDoorClearance(),
    ...chimneyExtension(selection),
    ...columnKit(),
    ...columnDoorPanel(selection),
    ...ovenDoorSwing(selection),
    ...microwaveReach(selection),
  ];
}

/**
 * Where the island's two machines went, when there is no island.
 *
 * A room without one still has to put the microwave drawer and the wine cabinet
 * somewhere, and where they end up is not obvious from looking: both are base
 * cabinets on the refrigerator's leg, the last two before its landing. Somebody
 * pricing the run needs to know that before they read the drawing, so it is a
 * line rather than a discovery.
 *
 * And when the leg would not take them even with everything on it at its
 * minimum, the room is built without them. That is the louder line of the two:
 * it is the one thing on this screen the customer did not ask for and cannot
 * see, and it comes with the two ways of getting them back.
 */
function noIslandFallback(): Finding[] {
  if (ISLAND.present) return [];

  if (OMITTED_SLOTS.length > 0) {
    return [
      {
        ruleId: "no-island-omitted",
        severity: "warning",
        messageKey: "rule.noIslandOmitted",
        slot: "slot-microwave",
        params: {},
      },
    ];
  }

  const runOf = (slot: SlotId) =>
    RUNS.find((run) => run.segments.some((segment) => segment.slot === slot))?.id;
  const wineRun = runOf("slot-wine");
  const microwaveRun = runOf("slot-microwave");
  if (!wineRun || !microwaveRun) return [];

  return [
    {
      ruleId: "no-island-fallback",
      severity: "info",
      messageKey: "rule.noIslandFallback",
      slot: "slot-microwave",
      params: { wineLegKey: `leg.${wineRun}`, microwaveLegKey: `leg.${microwaveRun}` },
    },
  ];
}

/**
 * Where the microwave's handle actually landed.
 *
 * The tower is cut to put it at the height asked for, and when that height is
 * outside what the machine's drawing allows the hole is clamped and the handle
 * lands somewhere else. That is a real answer rather than an error — but it is
 * the kind of thing nobody notices until they are standing in front of it, so
 * it says where the handle is, what was asked for, and the figure the sill was
 * chosen from.
 */
function microwaveReach(selection: Record<SlotId, Appliance>): Finding[] {
  const oven = selection["slot-microwave"];
  if (!oven || !isCombo(oven)) return [];

  const asked = LAYOUT_PARAMS.microwaveHandleIn;
  const { sillIn, clamped } = comboSillFor(asked);
  if (!clamped) return [];

  return [
    {
      ruleId: "microwave-reach",
      severity: "warning",
      messageKey: "rule.microwaveReach",
      slot: "slot-microwave",
      params: {
        atIn: round8(comboHandleAt(sillIn)),
        askedIn: round8(asked),
        sillIn: round8(sillIn),
        lowIn: round8(COMBO_OVEN.sillIn.min + COMBO_OVEN.microwaveHandleIn),
        highIn: round8(COMBO_OVEN.sillIn.max + COMBO_OVEN.microwaveHandleIn),
      },
    },
  ];
}

/** Eighths of an inch, which is how a figure like this is written down. */
const round8 = (value: number) => Math.round(value * 8) / 8;

/**
 * How far an oven door reaches into the room when it is open.
 *
 * D11 rule 7's 42" aisle already covers it — 26-5/8" of door in a 42" walkway
 * leaves room to stand — but nobody reading a plan can see a door that is
 * shut, and a tower beside the cooking surface puts that door where the cook
 * is standing. So the figure is on the list rather than implied by another
 * one. From docs/reference/mem301ws-manual.png.
 */
function ovenDoorSwing(selection: Record<SlotId, Appliance>): Finding[] {
  const oven = selection["slot-microwave"];
  if (!oven || !isCombo(oven)) return [];

  return [
    {
      ruleId: "oven-door-swing",
      severity: "info",
      messageKey: "rule.ovenDoorSwing",
      slot: "slot-microwave",
      params: { reachIn: COMBO_OVEN.doorReachIn },
    },
  ];
}

/**
 * The door a column wears, when it is not the cabinetmaker's.
 *
 * A column is sold panel-ready and the front is a decision: the joiner's door,
 * or one of the manufacturer's two stainless panels. Which one this kitchen
 * has is the row's own finish, so this line follows the catalogue rather than
 * deciding anything — a panel-ready row says nothing here and wears the
 * kitchen's door instead.
 */
function columnDoorPanel(selection: Record<SlotId, Appliance>): Finding[] {
  const wine = selection["slot-wine"];
  if (!wine || !isColumn(wine) || wine.finish.includes("panel-ready")) return [];

  return [
    {
      ruleId: "column-door-panel",
      severity: "info",
      messageKey: "rule.columnDoorPanel",
      slot: "slot-wine",
      params: {
        handleless: COLUMN_DOOR_PANELS.handleless,
        handleReady: COLUMN_DOOR_PANELS.handleReady,
      },
    },
  ];
}

/**
 * The kit that joins two refrigeration columns standing side by side.
 *
 * Not a rule anybody can fail — the generator already left the 5/8" for it —
 * but a part somebody has to order, and one that is easy to miss because it is
 * five eighths of an inch wide and holds up two machines. The line names it
 * and says which two it is between.
 */
function columnKit(): Finding[] {
  const spacer = RUNS.flatMap((run) => run.segments)
    .flatMap((segment) => segment.modules)
    .find((module) => module.kind === "spacer");
  if (!spacer) return [];

  return [
    {
      ruleId: "column-kit",
      severity: "info",
      messageKey: "rule.columnKit",
      slot: "slot-wine",
      params: { model: spacer.code, gapIn: spacer.widthIn },
    },
  ];
}

/** The extension a room taller than the chimney's own travel needs. */
function chimneyExtension(selection: Record<SlotId, Appliance>): Finding[] {
  const hood = selection["slot-hood"];
  if (!hood || !isChimney(hood)) return [];

  const slot = SLOT_BY_ID["slot-hood"];
  const canopyTop = slot.position[1] + applianceBox(slot, hood).h;
  const chimney = chimneyParts(canopyTop);
  const riseIn = Math.round(chimney.rise * 120) / 10;

  // Below one section the chimney will not shorten: it is not a cut-to-fit
  // part, and the canopy or the ceiling has to move instead.
  if (chimney.tooLow) {
    return [
      {
        ruleId: "chimney-too-low",
        severity: "warning",
        messageKey: "rule.chimneyTooLow",
        slot: "slot-hood",
        params: { riseIn, sectionIn: CHIMNEY.sectionIn },
      },
    ];
  }
  if (!chimney.needsExtension) return [];

  return [
    {
      ruleId: "chimney-extension",
      severity: "info",
      messageKey: "rule.chimneyExtension",
      slot: "slot-hood",
      params: {
        model: CHIMNEY.extension,
        overIn: Math.round(chimney.shortIn * 10) / 10,
        riseIn,
      },
    },
  ];
}

/**
 * The gap a freestanding refrigerator's door needs against a return wall.
 *
 * Not a rule anybody can fail — the generator already left the space — but a
 * line the installer has to read, because three and a half inches of empty
 * wall looks like a mistake until somebody says what it is for. The 90-degree
 * stop is the manufacturer's answer to the same problem, and is offered rather
 * than specified. See docs/decisions.md D11 rule 11.
 */
function fridgeDoorClearance(): Finding[] {
  const segment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-fridge");
  const filler = segment?.modules.find((module) => module.kind === "filler");
  if (!filler) return [];

  return [
    {
      ruleId: "fridge-door-clearance",
      severity: "info",
      messageKey: "rule.fridgeDoorClearance",
      slot: "slot-fridge",
      params: {
        gapIn: filler.widthIn,
        doorStop: LAYOUT_LIMITS.fridge.doorStop,
      },
    },
  ];
}
