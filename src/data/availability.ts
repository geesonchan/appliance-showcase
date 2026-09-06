import type { Appliance, SlotId } from "../types";

export interface SlotAvailability {
  available: boolean;
  /** Why the slot is unavailable, and which appliance took it. */
  reasonKey?: string;
  takenBy?: string;
}

/**
 * Which slots the current package has closed off.
 *
 * Only one rule so far, and it is the one the brief calls out: an
 * over-the-range microwave occupies the wall the hood would hang on, so
 * specifying one makes the hood slot unavailable rather than merely
 * questionable. This is different in kind from the checklist rules — those
 * describe extra work, this removes a choice — which is why it lives here and
 * not in rules.json. See docs/decisions.md D7.
 */
export function slotAvailability(
  selection: Partial<Record<SlotId, Appliance>>,
): Record<string, SlotAvailability> {
  const availability: Record<string, SlotAvailability> = {};

  const microwave = selection["slot-microwave"];
  if (microwave?.installType.includes("otr")) {
    availability["slot-hood"] = {
      available: false,
      reasonKey: "swap.unavailableOtr",
      takenBy: `${microwave.brand} ${microwave.model}`,
    };
  }

  return availability;
}
