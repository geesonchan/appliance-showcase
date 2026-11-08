import appliancesFile from "../../data/appliances.json";
import schemesFile from "../../data/schemes.json";
import type { Appliance, Package, PackageSlot, Scheme, SlotId } from "../types";
import {
  appliancesFileSchema,
  parseDataFile,
  schemesFileSchema,
} from "./schema";
import { SLOT_ORDER } from "./packages";
import { SLOT_RECORDS, openingAbove, openingHeightIn } from "./slots";
import { freestandingInBank, tooTallIn } from "./fit";
import { inColumnBank } from "./layoutTemplate";

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
 * Two rows that are one machine two ways, each naming the other in the
 * sheet's `pairModel`: T36BT120NS stainless and T36IT100NP panel-ready (Leo,
 * 2026-10-29, 2), and each built-in column, its own number panel-ready and
 * the number with -SS stainless (2026-11-02). By either one's id, the two
 * looks; each is its own model at its own price, so nothing about either is
 * rewritten. The import has checked that the pair holds.
 */
const PAIRS: Map<string, { stainless: string; panelReady: string }> = (() => {
  const pairs = new Map<string, { stainless: string; panelReady: string }>();
  for (const row of APPLIANCES) {
    const other = APPLIANCES.find(
      (candidate) => row.pairModel !== null && candidate.model === row.pairModel && candidate.pairModel === row.model,
    );
    const steel = other && [row, other].find((a) => a.finish[0] === "stainless");
    const panel = other && [row, other].find((a) => a.finish[0] === "panel-ready");
    if (steel && panel) pairs.set(row.id, { stainless: steel.id, panelReady: panel.id });
  }
  return pairs;
})();

/**
 * The two looks the model card offers for this machine, as a selection holds
 * them — one of a pair — or null for a machine offered one way.
 */
export function looksOf(appliance: Appliance): { stainless: string; panelReady: string } | null {
  return PAIRS.get(appliance.id) ?? null;
}

/**
 * A column's -SS row, for its own number: the stainless one of a pair whose
 * model is the other's with -SS (Leo, 2026-11-02). Before `v=3` a link wrote
 * a column's stainless look as its bare number, so this is what that number
 * meant. Undefined for anything else, the refrigerator pair included.
 */
export function stainlessRowOf(appliance: Appliance): Appliance | undefined {
  const looks = looksOf(appliance);
  const steel = looks && looks.panelReady === appliance.id ? APPLIANCE_BY_ID[looks.stainless] : undefined;
  return steel && steel.model.toUpperCase() === `${appliance.model}-SS`.toUpperCase() ? steel : undefined;
}

/**
 * Every candidate for a slot, cheapest first.
 *
 * By what the slot accepts rather than by where the import filed the model.
 * An appliance is filed under one slot, but a kitchen can have two openings
 * that take the same machine — package D has a dishwasher beside the sink and
 * another under its coffee machine, and a steam oven where package B has a
 * combination oven — and each of those openings has to offer the whole range.
 *
 * Blowers are filed under `slot-hood` because that is what they attach to, but
 * they are not candidates for the slot itself, so they are kept out here and
 * listed separately. See docs/decisions.md D6.
 */
const cheapestFirst = (a: Appliance, b: Appliance) => (a.msrpUSD ?? Infinity) - (b.msrpUSD ?? Infinity);

export const APPLIANCES_BY_SLOT: Record<SlotId, Appliance[]> = (() => {
  const grouped = {} as Record<SlotId, Appliance[]>;
  for (const record of SLOT_RECORDS) {
    grouped[record.id] = APPLIANCES.filter(
      (appliance) =>
        appliance.category !== "blower" &&
        record.compatibleCategories.includes(appliance.category),
    );
  }
  // Cheapest first, with unpriced models last rather than treated as free.
  for (const list of Object.values(grouped)) {
    list.sort(cheapestFirst);
  }
  return grouped;
})();

/**
 * Whether a package's opening for a range also takes a cooktop: where it is
 * built for a rangetop, so the run stands a cabinet in it and the stone is cut
 * over it, B's and D's (Leo, 2026-11-07: "B，D套餐里面的rangetop选择项里面，增加一个
 * induction cooktop的选项"). Not in the data's `compatibleCategories`, which is
 * the opening's in every package, and which the importer files models by.
 *
 * "36 inches or less" is the cabinet's opening against the hole the machine
 * needs (34-3/4" for CIT367YG), which `fitCheck` already measures; its glass
 * and catalogue width, 37", lies on the stone either side.
 */
export const takesCooktop = (slot: Pick<PackageSlot, "slotId" | "installType">) =>
  slot.slotId === "slot-range" && slot.installType === "rangetop";

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

/**
 * Ordering used by the left column, the pin numbering and the plan key.
 *
 * The active package's, and a live binding: see `SLOT_ORDER` in packages.ts.
 */
export { SLOT_ORDER } from "./packages";

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
 *
 * And since round 86, it has to go in: nothing taller than an opening with
 * something fixed above it, asked of `tooTallIn`, the judgement the fit check
 * makes for the list. A column's install type keeps it out of every such slot
 * but E's under the coffee machine, which no other package has, so no switch
 * carries one there today; the question is asked anyway, so the two copies of
 * "can this model go here" (D17's table, first row) answer height alike.
 */
export function suitsPackageSlot(appliance: Appliance, slot: PackageSlot, entry: Package): boolean {
  const cooktopHere = appliance.category === "cooktop" && takesCooktop(slot);
  if (!cooktopHere && appliance.category !== slot.category) return false;
  if (!cooktopHere && !appliance.installType.includes(slot.installType)) return false;
  const width = appliance.cutoutWidthIn ?? appliance.widthIn;
  if (width !== null && width > slot.widthIn) return false;
  const record = SLOT_RECORDS.find((candidate) => candidate.id === slot.slotId);
  if (!record) throw new Error(`data/slots.json has no ${slot.slotId}`);
  // Round 89: and no counter-depth refrigerator into a bank of columns, asked
  // of the fit check's own judgement.
  if (freestandingInBank(appliance, inColumnBank(entry, slot.slotId))) return false;
  return tooTallIn(appliance, openingHeightIn(record, slot), openingAbove(record, slot, entry.slots)) === null;
}

/**
 * The alternatives a package's slot offers.
 *
 * Width is not a reason to leave one out: a model wider than the opening is
 * offered and refused, with the overrun spelled out. How it hangs is. A hood
 * hung from the ceiling is not offered for a slot on a wall, nor a wall hood for
 * a slot over an island. Picked for a wall slot, HMIB42WS was drawn at that
 * slot's height with a stem sized as if it stood on the floor, 72" through the
 * ceiling, and in packages B and D a customer could pick it. Round 45.
 */
export function offeredFor(slotId: SlotId, packageSlot: PackageSlot | undefined): Appliance[] {
  const own = APPLIANCES_BY_SLOT[slotId] ?? [];
  if (!packageSlot) return own;
  const all = takesCooktop(packageSlot) ? [...own, ...APPLIANCES_BY_SLOT["slot-cooktop"]].sort(cheapestFirst) : own;
  const hungOverIsland = packageSlot.installType === "island";
  return all.filter((appliance) => appliance.installType.includes("island") === hungOverIsland);
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
    selection[slot.slotId] = kept && suitsPackageSlot(kept, slot, entry) ? kept.id : fallback;
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

    // Filed under a slot that does not take it is still a mistake in the scheme.
    // Filed under a different slot that also takes it — the second dishwasher,
    // say — is not.
    const accepts = SLOT_RECORDS.find((record) => record.id === slotId)?.compatibleCategories;
    if (appliance && !accepts?.includes(appliance.category)) {
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
  // The active package's slots that the scheme fills. A scheme names the six
  // core slots; a larger package's own are filled from the package, not here.
  return Object.fromEntries(
    SLOT_ORDER.flatMap((slotId) => {
      const id = scheme.defaultSelection[slotId];
      return id ? [[slotId, APPLIANCE_BY_ID[id]]] : [];
    }),
  ) as Record<SlotId, Appliance>;
}

/**
 * The package as currently specified.
 *
 * M2 step 1 reads the scheme default. Step 2 replaces this with a store
 * selector so swapping a model updates the scene; nothing else needs to move.
 */
export const APPLIANCE_BY_SLOT: Record<SlotId, Appliance> = selectionFor(SCHEME);
