import appliancesFile from "../../data/appliances.json";
import type { Package, PackageSlot } from "../types";

/**
 * How an oven tower is built round its oven — asked in one place.
 *
 * Round 92c, Leo, his site practice in his words: "如果 MEM301WS 是 Flush 安装，
 * 侧板要多出 3/4" 侧板出来，如果是 standard 安装，整个 tower 的总宽度连侧板就是
 * 30"". Every oven tower here is a standard install (Leo, round 92c: B, D and
 * E): the tower is the package slot's width overall, 30", its two sides
 * inside that, and the hole between them is the oven's standard cutout,
 * 28-1/2" — MEM301WS and PODS302B, and ME301YP and PO302W that the towers
 * also take, each on its own sheet's pp. 1-3 (docs/reference/). So each side
 * is (30" - 28-1/2") / 2 = 3/4", worked out here rather than written again.
 *
 * Until round 92c three places said three things (D17's table): the
 * importer's note on MEM301WS said this; `standardInstall` worked the 3/4"
 * out and nothing drew it; and the run built a 30" hole with a separate 3/4"
 * board outside it toward the range (B, D) or both sides (E) — neither
 * install. The run (`column` in layoutTemplate.ts), the slot's opening
 * (slots.ts), the trim (`standardInstall`) and rule 12's check all ask this.
 *
 * Flush — a 30" hole with the sides outside it — is registered as a package's
 * choice for later (Open items); the schema takes only "standard" until then.
 *
 * Kept in a module with no imports from the room, as cookingSurface.ts is.
 */
export interface OvenTower {
  install: "standard";
  /** The tower overall, its two sides included: the package slot's width. */
  overallIn: number;
  /** The hole the oven goes in: the standard cutout of the oven the tower is built for. */
  openingIn: number;
  /** Each side of the carcass, inside the overall width. */
  sideIn: number;
  /** The oven the tower is built for: the package's own. */
  model: string;
}

type Row = { id: string; model: string; cutoutWidthIn: number | null };
const ROWS = (appliancesFile as { appliances: Row[] }).appliances;

/** Whether a package slot is an oven tower: a wall oven in a tall unit. */
export const isOvenTower = (spec: Pick<PackageSlot, "category" | "tallUnit">) =>
  spec.category === "wall-oven" && spec.tallUnit;

/**
 * The oven tower a package builds in this slot, or null for any other slot.
 *
 * Built for the package's own oven, as the joiner builds it: a model chosen on
 * the card goes into that hole or is refused on its own cutout (`fitCheck`).
 * An oven tower that does not say how it is installed, or whose own oven has
 * left the catalogue, is refused loudly rather than guessed (D4).
 */
export function ovenTowerOf(
  pkg: Pick<Package, "id" | "defaultSelection">,
  spec: PackageSlot,
): OvenTower | null {
  if (!isOvenTower(spec)) return null;
  if (spec.towerInstall !== "standard") {
    throw new Error(`${pkg.id} ${spec.slotId}: an oven tower must say how it is installed (towerInstall)`);
  }
  const own = ROWS.find((row) => row.id === pkg.defaultSelection[spec.slotId]);
  if (!own || own.cutoutWidthIn === null) {
    throw new Error(`${pkg.id} ${spec.slotId}: the tower's own oven has no published cutout to build it round`);
  }
  const sideIn = (spec.widthIn - own.cutoutWidthIn) / 2;
  if (sideIn <= 0) {
    throw new Error(`${pkg.id} ${spec.slotId}: a ${spec.widthIn}" tower leaves no side round a ${own.cutoutWidthIn}" cutout`);
  }
  return { install: "standard", overallIn: spec.widthIn, openingIn: own.cutoutWidthIn, sideIn, model: own.model };
}
