import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package, SlotId } from "../types";

/**
 * How a hood hangs, and so what stands over it. Round 87, Leo.
 *
 * From Leo using package A: its under-cabinet hood changed on the model card to
 * the insert liner VCIN36GWS, and the liner hung on its own between the wall
 * cabinets, with no housing. **Leo's site practice:** an insert hood always
 * comes with its housing — the same reason a rangetop always has a base
 * cabinet under it (D16, round 83). What is over a hood is the chosen hood's
 * to say, not the package's:
 * - **under-cabinet** — screwed to the underside of a cabinet, which is the
 *   bridge over it, and the duct goes up through that cabinet;
 * - **insert** — a liner in a housing the cabinetmaker builds, which runs to
 *   the ceiling, the duct inside it;
 * - **chimney** — its own duct cover to the ceiling, and nothing over it;
 * - **island** — hung from the ceiling over the island;
 * - **otr** — an over-the-range microwave, which is the hood (round 97, Leo):
 *   screwed to the wall and to the underside of a cabinet over it, as an
 *   under-cabinet hood is, and its duct goes up through that cabinet. GE's
 *   JVM3160RFSS installation instructions, p. 2: "It must be mounted to BOTH a
 *   top cabinet AND a wall."
 *
 * **The one answer** (D17's table, the thirteenth): the wall cabinets over the
 * hood, where it hangs, the duct's route, the housing-shape control, the strips
 * beside it and how wide the checklist takes it to be all ask this. Until round
 * 87 the first three read the package's hood slot and the rest the model, so a
 * swap on the model card left the room built for the package's own hood.
 *
 * Kept in a module with no imports from the room, as `cookingSurface.ts` is, so
 * the layout template can ask it.
 */
export type HoodMount = "under-cabinet" | "insert" | "chimney" | "island" | "otr";

export function hoodMount(hood: Pick<Appliance, "installType" | "id">): HoodMount {
  const types = hood.installType;
  if (types.includes("otr")) return "otr";
  if (types.includes("island")) return "island";
  if (types.includes("insert")) return "insert";
  // HMCB30WS is `wall-mount` and `chimney`: a wall hood with its own duct cover.
  if (types.includes("chimney")) return "chimney";
  if (types.includes("under-cabinet")) return "under-cabinet";
  throw new Error(`${hood.id}: no install type says how this hood hangs (${types.join(", ")})`);
}

/**
 * The duct's route for a hood that hangs this way.
 *
 * The package's own route, unless it cannot be this hood's: a chimney hood has
 * no cabinet over it to go up through, so it goes through the ceiling, as C's
 * does; a hood under a cabinet or in a housing goes up through that. A route
 * out through the wall behind is either's. An island hood's is the package's.
 * Round 87 (Leo: the duct's words follow the hood).
 *
 * An over-the-range microwave goes up through the cabinet over it and on out
 * of the house — Leo's shop practice, round 97: "排风默认外排：从 OTR 往上穿过
 * 上方吊柜，再往外排". Its manual offers three ways (p. 11: recirculating,
 * outside top, outside back); this is the second.
 */
export function ductRouteFor<R extends string>(mount: HoodMount, packageRoute: R): R | "through-ceiling" | "up-through-cabinet" {
  if (mount === "chimney" && packageRoute === "up-through-cabinet") return "through-ceiling";
  if ((mount === "under-cabinet" || mount === "insert") && packageRoute === "through-ceiling") {
    return "up-through-cabinet";
  }
  if (mount === "otr") return "up-through-cabinet";
  return packageRoute;
}

/** Whether a cabinet hangs over this hood and carries it: a bridge, not a housing. */
export const hungUnderACabinet = (mount: HoodMount | null) => mount === "under-cabinet" || mount === "otr";

/**
 * How far an over-the-range microwave's underside is above the cooking surface
 * the wall was drilled for. Leo's shop practice, round 97: "OTR 底部离炉头平面
 * 默认 24""".
 *
 * GE's manual sets no figure for the underside. It asks for the cabinet over it
 * "30" or more from the cooking surface" and the oven's top "66" or more from
 * the floor" (31-7000341, p. 6), and 2" from its bottom to the range's
 * backguard (spec sheet, p. 1) — which a 16-1/2" JVM3160RFSS 24" over a 36"
 * cooking surface clears at 40-1/2", 76-1/2" and 12-1/8". The clearance drawing
 * in docs/reference, `OTR-hood-clearance.png`, draws "min. 30"" from the
 * burners to an OTR's underside; it is from an unnamed cooking appliance's
 * manual and defers to the OTR maker's ("Refer to OTR manufacturer's
 * installation manual for clearances"), so the GE manual is followed (Leo,
 * round 97; decisions.md D13).
 */
export const OTR_ABOVE_COOKING_SURFACE_IN = 24;

/**
 * The one answer to how far a wall hood's underside hangs over the cooking
 * surface the wall was drilled for: a canopy's clearance (`canopyIn`, D13), or
 * an over-the-range microwave's 24". The hood's placement, the housing's band
 * and the dimension drawn in the room all ask this.
 */
export function aboveCookingSurfaceIn(mount: HoodMount | null, canopyIn: number): number {
  return mount === "otr" ? OTR_ABOVE_COOKING_SURFACE_IN : canopyIn;
}

/**
 * The hood the customer chose, and the package it was chosen in.
 *
 * Round 78 kept one hood for the cabinets over it to stand on. Round 87 ties
 * it to its package, as the range is (`rangeModelFor`): a package switch builds
 * the new room before the store records the new package's hood, and that room
 * has to be built round its own hood, not the one chosen in the package left.
 */
let CHOSEN: { packageId: string; appliance: Appliance } | null = null;

export function recordHoodModel(appliance: Appliance | undefined, packageId: string) {
  CHOSEN = appliance ? { packageId, appliance } : null;
}

/** The hood a package's room is built round: the one chosen in it, or its own. */
export function hoodModelFor(pkg: Package): Appliance | undefined {
  if (CHOSEN && CHOSEN.packageId === pkg.id) return CHOSEN.appliance;
  const id = pkg.defaultSelection["slot-hood"];
  if (!id) return undefined;
  const rows = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
  return rows.find((row) => row.id === id);
}

/**
 * What the room is built without because of the hood chosen. Round 97, Leo's
 * shop practice, his words: "安装了 OTR 之后，岛台的 microwave drawer 就不需要
 * 了。有 OTR 的厨房多半是老式的小厨房，很大机会没有岛台。"
 *
 * With an over-the-range microwave on the wall, the package's microwave
 * drawer — the microwave opening that is not a tall unit — is not built:
 * not on the island, and not on the wall of a room with none. Its choice is
 * kept, so a hood chosen again brings it back as it was. Not D18's want of
 * wall, and not said as that: the room was not too small for it.
 *
 * The one place this is decided; the generator leaves the slot out with it
 * (`layoutTemplate.ts`), and everything that draws, counts or quotes reads
 * the room.
 */
export function leftOutByHood(pkg: Package): readonly SlotId[] {
  if (hoodMountFor(pkg) !== "otr") return [];
  const microwave = pkg.slots.find((slot) => slot.slotId === "slot-microwave");
  return microwave && microwave.category === "microwave" && !microwave.tallUnit ? ["slot-microwave"] : [];
}

/** How a package's own hood, or the one chosen in it, hangs; null where it has no hood. */
export function hoodMountFor(pkg: Package): HoodMount | null {
  const hood = hoodModelFor(pkg);
  return hood ? hoodMount(hood) : null;
}
