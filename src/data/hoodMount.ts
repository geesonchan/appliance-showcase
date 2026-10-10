import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package } from "../types";

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
 * - **island** — hung from the ceiling over the island.
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
export type HoodMount = "under-cabinet" | "insert" | "chimney" | "island";

export function hoodMount(hood: Pick<Appliance, "installType" | "id">): HoodMount {
  const types = hood.installType;
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
 */
export function ductRouteFor<R extends string>(mount: HoodMount, packageRoute: R): R | "through-ceiling" | "up-through-cabinet" {
  if (mount === "chimney" && packageRoute === "up-through-cabinet") return "through-ceiling";
  if ((mount === "under-cabinet" || mount === "insert") && packageRoute === "through-ceiling") {
    return "up-through-cabinet";
  }
  return packageRoute;
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

/** How a package's own hood, or the one chosen in it, hangs; null where it has no hood. */
export function hoodMountFor(pkg: Package): HoodMount | null {
  const hood = hoodModelFor(pkg);
  return hood ? hoodMount(hood) : null;
}
