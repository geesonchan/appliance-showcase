import appliancesFile from "../../data/appliances.json";
import schemesFile from "../../data/schemes.json";
import type { Appliance, Scheme, SlotId } from "../types";
import {
  appliancesFileSchema,
  parseDataFile,
  schemesFileSchema,
} from "./schema";
import { SLOT_BY_ID } from "./slots";

/**
 * The appliance catalogue and the schemes built from it.
 *
 * Validation runs at import time, so a malformed row stops the app at startup
 * with a readable error rather than surfacing as a wrong fit check or a blank
 * spec card later on.
 */
const parsedAppliances = parseDataFile(
  appliancesFileSchema,
  appliancesFile,
  "data/appliances.json",
);
const parsedSchemes = parseDataFile(schemesFileSchema, schemesFile, "data/schemes.json");

export const APPLIANCES: Appliance[] = parsedAppliances.appliances;
export const CATALOGUE_META = parsedAppliances._meta;

export const APPLIANCE_BY_ID: Record<string, Appliance> = Object.fromEntries(
  APPLIANCES.map((appliance) => [appliance.id, appliance]),
);

/**
 * Every candidate for a slot, cheapest first.
 *
 * Blowers are filed under `slot-hood` because that is what they attach to, but
 * they are not candidates for the slot itself, so they are kept out here and
 * listed separately. See docs/decisions.md D6.
 */
export const APPLIANCES_BY_SLOT: Record<SlotId, Appliance[]> = (() => {
  const grouped = {} as Record<SlotId, Appliance[]>;
  for (const slotId of Object.keys(SLOT_BY_ID) as SlotId[]) grouped[slotId] = [];
  for (const appliance of APPLIANCES) {
    if (appliance.category === "blower") continue;
    grouped[appliance.slot].push(appliance);
  }
  // Cheapest first, with unpriced models last rather than treated as free.
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => (a.msrpUSD ?? Infinity) - (b.msrpUSD ?? Infinity));
  }
  return grouped;
})();

/** The blowers on offer, cheapest first. */
export const BLOWERS: Appliance[] = APPLIANCES.filter(
  (appliance) => appliance.category === "blower",
).sort((a, b) => (a.msrpUSD ?? Infinity) - (b.msrpUSD ?? Infinity));

/** Blowers from the same maker as a hood, which is how they are actually paired. */
export function blowersFor(hood: Appliance): Appliance[] {
  const sameBrand = BLOWERS.filter((blower) => blower.brand === hood.brand);
  return sameBrand.length > 0 ? sameBrand : BLOWERS;
}

/** Ordering used by the left column, the pin numbering and the plan key. */
export const SLOT_ORDER: SlotId[] = [
  "slot-fridge",
  "slot-range",
  "slot-hood",
  "slot-dishwasher",
  "slot-microwave",
  "slot-wine",
];

function resolveScheme(scheme: (typeof parsedSchemes.schemes)[number]): Scheme {
  // Cross-file integrity: zod can check the shape of an id but not that the
  // appliance it names exists, or that it belongs to the slot it is filed under.
  for (const [slotId, applianceId] of Object.entries(scheme.defaultSelection)) {
    const appliance = APPLIANCE_BY_ID[applianceId];
    if (!appliance) {
      throw new Error(
        `data/schemes.json: ${scheme.id} selects unknown appliance "${applianceId}" for ${slotId}`,
      );
    }
    if (appliance.slot !== slotId) {
      throw new Error(
        `data/schemes.json: ${scheme.id} puts ${applianceId} in ${slotId}, but it belongs to ${appliance.slot}`,
      );
    }
  }
  return scheme as Scheme;
}

export const SCHEMES: Scheme[] = parsedSchemes.schemes.map(resolveScheme);
export const SCHEME: Scheme = SCHEMES[0];

/** Resolve a scheme's id-based selection into the appliances themselves. */
export function selectionFor(scheme: Scheme): Record<SlotId, Appliance> {
  return Object.fromEntries(
    SLOT_ORDER.map((slotId) => [slotId, APPLIANCE_BY_ID[scheme.defaultSelection[slotId]]]),
  ) as Record<SlotId, Appliance>;
}

/**
 * The package as currently specified.
 *
 * M2 step 1 reads the scheme default. Step 2 replaces this with a store
 * selector so swapping a model updates the scene; nothing else needs to move.
 */
export const APPLIANCE_BY_SLOT: Record<SlotId, Appliance> = selectionFor(SCHEME);
