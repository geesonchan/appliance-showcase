import { useMemo } from "react";
import { APPLIANCE_BY_ID, SLOT_ORDER } from "../data/catalogue";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "../data/packages";
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

/** The blower specified with the hood, if the hood needs one and one is chosen. */
export function useSelectedBlower(): Appliance | null {
  const blowerId = useAppStore((s) => s.blowerId);
  return blowerId ? (APPLIANCE_BY_ID[blowerId] ?? null) : null;
}

/**
 * The package the room is built to, and its name in the reader's language.
 *
 * The name lives in `data/packages.json` in both languages rather than in the
 * dictionary, because it is the product's name and not the interface's copy —
 * the same place `highlights` lives, and for the same reason.
 */
export function useActivePackage() {
  const packageId = useAppStore((s) => s.packageId);
  const lang = useAppStore((s) => s.lang);
  const entry = PACKAGE_BY_ID[packageId] ?? DEFAULT_PACKAGE;
  return { entry, name: entry.name[lang] ?? entry.name.en };
}
