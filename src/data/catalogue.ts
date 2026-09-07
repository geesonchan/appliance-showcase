import appliancesFile from "../../data/appliances.json";
import schemesFile from "../../data/schemes.json";
import type { Appliance, Package, PackageSlot, Scheme, SlotId } from "../types";
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

/**
 * The blowers a hood will take.
 *
 * From the manufacturer's own compatibility chart, carried on the hood. Pairing
 * by brand was a guess that happens to be right until a Zephyr blower turns up
 * beside a Thermador hood — and it is wrong within a brand too, since VTN1DZ
 * fits the 30" Thermador hood and not the 36".
 *
 * An unchecked hood offers everything in stock rather than nothing, and says so.
 * See docs/decisions.md D13.
 */
export function blowersFor(hood: Appliance): Appliance[] {
  if (hood.compatibleBlowers.length === 0) return BLOWERS;
  const wanted = new Set(hood.compatibleBlowers.map((model) => model.toUpperCase()));
  return BLOWERS.filter((blower) => wanted.has(blower.model.toUpperCase()));
}

/** True when nobody has checked what this hood takes. */
export const blowerListUnverified = (hood: Appliance) => hood.compatibleBlowers.length === 0;

/** Ordering used by the left column, the pin numbering and the plan key. */
export const SLOT_ORDER: SlotId[] = [
  "slot-fridge",
  "slot-range",
  "slot-hood",
  "slot-dishwasher",
  "slot-microwave",
  "slot-wine",
];

/**
 * Whether a model can stand in the slot this package specifies.
 *
 * Three questions, and the third is the one that is easy to miss. The category
 * has to match. The width has to fit, by the same rule the fit check uses — the
 * published cutout where there is one, otherwise the body, and narrower is a
 * filler rather than a refusal. And it has to install the way the package
 * installs it: a built-in refrigerator is 36" wide and fits package C's 36"
 * opening perfectly, and it is still the wrong machine, because package C
 * leaves it standing at the end of a run with the finished sides it does not
 * have.
 */
export function suitsPackageSlot(appliance: Appliance, slot: PackageSlot): boolean {
  if (appliance.category !== slot.category) return false;
  if (!appliance.installType.includes(slot.installType)) return false;
  const width = appliance.cutoutWidthIn ?? appliance.widthIn;
  return width === null || width <= slot.widthIn;
}

/**
 * The selection carried across a package change.
 *
 * By slot id, because the six slots do not change: a dishwasher stays a
 * dishwasher wherever it is specified from. Two things stop one coming across.
 *
 * It may not fit what the new package leaves — a 36" range in a 30" opening, or
 * a built-in refrigerator where the new package stands one at the end of a run
 * with no panels. Those fall back to the new package's own default rather than
 * being drawn overhanging their cabinet.
 *
 * And it may never have been chosen at all. A slot still sitting on the
 * outgoing package's default was specified by that package, not by the
 * customer, so it gives way to what the incoming one specifies — otherwise
 * asking for package C shows you package A's dishwasher and calls it C. A
 * deliberate swap is a different thing and does come across.
 *
 * With nothing to carry it also builds the opening selection, so there is one
 * function rather than two that have to agree.
 */
export function migrateSelection(
  entry: Package,
  current: Partial<Record<SlotId, string>> = {},
  from?: Package,
): Record<SlotId, string> {
  const selection = {} as Record<SlotId, string>;
  for (const slot of entry.slots) {
    const id = current[slot.slotId];
    const fallback = entry.defaultSelection[slot.slotId];
    if (!fallback) {
      throw new Error(`data/packages.json: ${entry.id} has no default for ${slot.slotId}`);
    }
    const untouched = from ? from.defaultSelection[slot.slotId] === id : false;
    const kept = id && !untouched ? APPLIANCE_BY_ID[id] : undefined;
    selection[slot.slotId] = kept && suitsPackageSlot(kept, slot) ? kept.id : fallback;
  }
  return selection;
}

/**
 * The blower that goes with a package's hood.
 *
 * A hood with a blower in it takes none, and carrying one across from a package
 * whose hood needed one leaves a part on the quote that fits nothing. Otherwise
 * the current choice stands if the new hood accepts it, and the package's own
 * default takes over if it does not.
 */
export function migrateBlower(entry: Package, hood: Appliance, current: string | null) {
  if (hood.blower === "integrated") return null;
  const kept = current ? APPLIANCE_BY_ID[current] : undefined;
  if (kept && blowersFor(hood).some((blower) => blower.id === kept.id)) return kept.id;
  return entry.defaultBlower;
}

/**
 * Reconcile a scheme with the catalogue actually loaded.
 *
 * A scheme is a preference, not a constraint: the catalogue is re-imported from
 * the inventory sheet whenever stock changes, and a model that has left it must
 * not stop the app. A missing selection falls back to the cheapest candidate
 * for that slot and says so; a selection filed under the wrong slot is a real
 * mistake in the scheme and still throws.
 */
/**
 * Slots whose scheme selection was not in the catalogue, and the id it asked
 * for. Surfaced under ?debug=1 so a silent fallback is still visible to anyone
 * looking for it.
 */
export const SCHEME_FALLBACKS: Partial<Record<SlotId, string>> = {};

function resolveScheme(scheme: (typeof parsedSchemes.schemes)[number]): Scheme {
  const defaultSelection: Record<string, string> = {};

  for (const [slotId, applianceId] of Object.entries(scheme.defaultSelection)) {
    const appliance = APPLIANCE_BY_ID[applianceId];

    if (appliance && appliance.slot !== slotId) {
      throw new Error(
        `data/schemes.json: ${scheme.id} puts ${applianceId} in ${slotId}, but it belongs to ${appliance.slot}`,
      );
    }

    if (appliance) {
      defaultSelection[slotId] = applianceId;
      continue;
    }

    const fallback = APPLIANCES_BY_SLOT[slotId as SlotId]?.[0];
    if (!fallback) {
      throw new Error(
        `data/schemes.json: ${scheme.id} selects unknown appliance "${applianceId}" for ${slotId}, and the catalogue has nothing else for that slot`,
      );
    }
    console.warn(
      `data/schemes.json: ${scheme.id} selects "${applianceId}" for ${slotId}, which is no longer in the catalogue. Falling back to ${fallback.id}.`,
    );
    SCHEME_FALLBACKS[slotId as SlotId] = applianceId;
    defaultSelection[slotId] = fallback.id;
  }

  // The blower is optional by nature, so a missing one is simply not specified.
  const defaultBlower =
    scheme.defaultBlower && APPLIANCE_BY_ID[scheme.defaultBlower]
      ? scheme.defaultBlower
      : null;

  return { ...scheme, defaultSelection, defaultBlower } as Scheme;
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
