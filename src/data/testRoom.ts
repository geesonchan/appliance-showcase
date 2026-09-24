import { APPLIANCE_BY_ID } from "./catalogue";
import { setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID, setPackage } from "./packages";
import type { Appliance, SlotId } from "../types";

/**
 * A package's own machines, slot by slot, as the page opens on it. For tests
 * that ask the room a question whose answer depends on the machine in a slot —
 * which tower breathes at its back, since round 73.
 */
export function defaultSelectionOf(id: string): Record<SlotId, Appliance> {
  return Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[id].defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model as string]]),
  ) as Record<SlotId, Appliance>;
}

/**
 * Put the room back to package A's default kitchen, whatever it was before.
 *
 * For tests. They used to write this as a customer's switch —
 * `setActivePackage(DEFAULT_PACKAGE.id)` then `setLayoutParams(DEFAULT_PARAMS)`
 * — and a switch can be refused: package A would not take a room a previous test
 * had grown for a turned island, the window would not sit evenly, and so the
 * switch correctly left the room on the package it was on. The next line then
 * set A's default parameters on *that* package, and the next "switch" to it was
 * a no-op. It never mattered while nothing depended on a package's own default
 * room being applied; round 56 gave a cooktop island its own 48" aisle, and the
 * default 42" on a cooktop package is refused. A reset is not a choice anybody
 * can refuse, so it does not go through the one that can be.
 */
export function resetRoom() {
  setPackage(DEFAULT_PACKAGE.id);
  const result = setLayoutParams(DEFAULT_PARAMS);
  if (!result.ok) {
    throw new Error(`the default room would not build: ${JSON.stringify(result.reasons)}`);
  }
}
