import { useMemo } from "react";
import { APPLIANCE_BY_ID, SLOT_ORDER } from "../data/catalogue";
import type { Appliance, SlotId } from "../types";
import { useAppStore } from "./useAppStore";

/**
 * The package as currently specified, resolved from ids to appliances.
 *
 * Everything that shows a model — the scene, the pins, both panels, the
 * utility layers — reads this, so a swap updates all of them from one write.
 */
export function useSelection(): Record<SlotId, Appliance> {
  const selection = useAppStore((s) => s.selection);
  return useMemo(
    () =>
      Object.fromEntries(
        SLOT_ORDER.map((slotId) => [slotId, APPLIANCE_BY_ID[selection[slotId]]]),
      ) as Record<SlotId, Appliance>,
    [selection],
  );
}

export function useSelectedAppliance(slotId: SlotId): Appliance {
  const applianceId = useAppStore((s) => s.selection[slotId]);
  return APPLIANCE_BY_ID[applianceId];
}
