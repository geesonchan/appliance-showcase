import { useMemo } from "react";
import { SLOT_ORDER } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { evaluateSlot, packageContext, type Finding } from "./rules";
import { resolveRoughIn, roughInSentence } from "./roughIn";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { applianceBox } from "./applianceBox";
import { CHIMNEY, chimneyParts, isChimney } from "./hood";
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
  const hood = selection["slot-hood"];
  if (!hood || !isChimney(hood)) return [];

  const slot = SLOT_BY_ID["slot-hood"];
  const canopyTop = slot.position[1] + applianceBox(slot, hood).h;
  const chimney = chimneyParts(canopyTop);
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
        riseIn: Math.round(chimney.rise * 120) / 10,
      },
    },
  ];
}
