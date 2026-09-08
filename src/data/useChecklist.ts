import { useMemo } from "react";
import { SLOT_ORDER } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { evaluateSlot, packageContext, type Finding } from "./rules";
import { resolveRoughIn, roughInSentence } from "./roughIn";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { applianceBox } from "./applianceBox";
import { CHIMNEY, chimneyParts, isChimney } from "./hood";
import { ISLAND, LAYOUT_LIMITS, RUNS } from "./room";
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
  return [...noIslandFallback(), ...fridgeDoorClearance(), ...chimneyExtension(selection)];
}

/**
 * Where the island's two machines went, when there is no island.
 *
 * A room without one still has to put the microwave drawer and the wine cabinet
 * somewhere, and where they end up is not obvious from looking: the drawer is
 * in the base beside the range, under the landing, and the wine cabinet is at
 * the far end of the refrigerator's leg. Somebody pricing the run needs to know
 * that before they read the drawing, so it is a line rather than a discovery.
 */
function noIslandFallback(): Finding[] {
  if (ISLAND.present) return [];

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
