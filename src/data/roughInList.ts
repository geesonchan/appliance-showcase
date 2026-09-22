import { SLOT_ORDER } from "./catalogue";
import {
  lineTier,
  resolveRoughIn,
  roughInCalloutKey,
  roughInWords,
  type LineTier,
  type ResolvedPoint,
} from "./roughIn";
import { isOmitted } from "./slots";
import type { Appliance, SlotId } from "../types";

/**
 * Every rough-in point the room draws for what is in it, in one list.
 *
 * The scene draws from it and the panel lists from it, so a point in the panel
 * is exactly a point in the room: picking one in the list highlights the same
 * point and says the same thing a click on it would (round 42). The list does
 * not depend on the point being clickable, which most of them are not while an
 * appliance stands in front.
 */
export interface RoughInItem {
  /** Stable for a slot and a point: `slot-dishwasher:2`. */
  key: string;
  slotId: SlotId;
  resolved: ResolvedPoint;
  tier: LineTier;
}

/** The order the panel groups them in, strongest first. */
export const TIER_ORDER: LineTier[] = ["confirmed", "unconfirmed", "unreviewed"];

export const roughInKey = (slotId: SlotId, index: number) => `${slotId}:${index}`;

export function listRoughIn(selection: Partial<Record<SlotId, Appliance | undefined>>): RoughInItem[] {
  return SLOT_ORDER.flatMap((slotId) =>
    // A machine that is not in the room has nothing to rough in for.
    isOmitted(slotId)
      ? []
      : resolveRoughIn(slotId, selection[slotId]).map((resolved, i) => ({
          key: roughInKey(slotId, i),
          slotId,
          resolved,
          tier: lineTier(resolved.point),
        })),
  );
}

/** The callout a point shows, whether it is clicked in the room or picked in the list. */
export function roughInCallout(item: RoughInItem) {
  // Keys, not words: the toast renders them in the page's language (`sayWith`).
  return {
    key: roughInCalloutKey(item.resolved.point),
    vars: roughInWords(item.resolved),
  };
}
