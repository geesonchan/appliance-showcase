import { useMemo } from "react";
import { SLOT_ORDER } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { evaluateSlot, packageContext, type Finding } from "./rules";
import { useSelection, useSelectedBlower } from "../store/useSelection";

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
    const context = packageContext(selection["slot-hood"], blower);
    const findings = [
      ...SLOT_ORDER.flatMap((slotId) =>
        evaluateSlot(SLOT_BY_ID[slotId], selection[slotId], context),
      ),
      // Package-wide findings are attributed to the hood, which is what they
      // are actually about.
      ...evaluateSlot(SLOT_BY_ID["slot-hood"], selection["slot-hood"], context, "package"),
    ];
    return {
      findings,
      blockers: findings.filter((f) => f.severity === "blocker").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
    };
  }, [selection, blower]);
}
