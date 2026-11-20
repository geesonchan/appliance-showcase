import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package, PackageSlot, SlotId } from "../types";
import type { LayoutShape } from "./layoutShape";
import { isOvenTower } from "./ovenTower";
import { PACKAGE_SHAPE, shapeOfChoice, shapeOfPackage, slotsOf } from "./packages";
import { COMBO_OVEN, comboSillFor, isCombo } from "./columnModel";

/**
 * The oven chosen for a package's oven tower, and the opening it needs.
 *
 * Leo, 2026-11-09, the ovens' plan, 5-2 (甲): 「PO302W 在 B 里照甲：选这台时开口长到
 * 50"，上面的柜门短 1-1/2"。」 B's tower is built for MEM301WS's 48-1/2"; PO302W's
 * standard cutout is at least 50" (po302w-spec.pdf p. 1), and in 48-1/2" its
 * control panel stood behind the door over the tower. Written once, for every
 * tower: the opening grows to the chosen oven's standard cutout where that is
 * taller than the tower was built for, and never shrinks — ME301YP keeps the
 * tower's hole and the panel over it (D20: the joiner builds the tower to the
 * machine). The sill stays where the reach rule puts it, so what grows is the
 * opening's head and the cabinet over it is that much shorter.
 *
 * Tied to its package and shape, as the refrigerator is (`fridgeMount.ts`).
 */
let CHOSEN: { packageId: string; shape: LayoutShape; appliance: Appliance } | null = null;

export function recordTowerOven(appliance: Appliance | undefined, packageId: string, shape: LayoutShape = PACKAGE_SHAPE) {
  CHOSEN = appliance ? { packageId, shape: shapeOfChoice(packageId, shape), appliance } : null;
}

/** The package's oven tower slot, or null where it has none. */
export function towerSlotOf(pkg: Package): SlotId | null {
  const spec = Object.values(slotsOf(pkg)).find(isOvenTower);
  return spec ? spec.slotId : null;
}

/** The oven a package's tower is built round: the one chosen in it, or its own. */
export function towerOvenFor(pkg: Package): Appliance | undefined {
  if (CHOSEN && CHOSEN.packageId === pkg.id && CHOSEN.shape === shapeOfPackage(pkg)) return CHOSEN.appliance;
  const slot = towerSlotOf(pkg);
  const id = slot ? pkg.defaultSelection[slot] : undefined;
  if (!id) return undefined;
  const rows = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
  return rows.find((row) => row.id === id);
}

/** The opening's height: the tower's own, grown to the oven's standard cutout where that is taller. */
export function towerOpeningHeightIn(builtIn: number, oven: Pick<Appliance, "cutoutHeightIn"> | undefined): number {
  const needs = oven?.cutoutHeightIn ?? null;
  return needs !== null && needs > builtIn ? needs : builtIn;
}

/**
 * How far off the floor each oven's own sheet lets its opening start, wall
 * mounted: the wall-mount drawing on p. 2 of each spec sheet (printed "Page 2
 * of 3"), read from the floor (Leo, 2026-11-16, 12b, F: 「还按切口底离地」 —
 * read strictly, the drawing's upper end is the underside of the shelf under
 * the opening, a shelf's thickness lower, which it does not give; the
 * installation guide's p. 24 calls the figures under the oven a general
 * guideline).
 */
export const OVEN_SILL_RANGE_IN: Record<string, { min: number; max: number }> = {
  // pods302b-spec.pdf p. 2: 4-3/4"-18-3/4" (121-476 mm).
  PODS302B: { min: 4.75, max: 18.75 },
  // po302w-spec.pdf p. 2: 4-3/4"-14-7/8" (121-378 mm).
  PO302W: { min: 4.75, max: 14.875 },
  // me301yp-spec.pdf p. 2: 4-3/4"-38" (121-964 mm).
  ME301YP: { min: 4.75, max: 38 },
  // mem301ws-spec.pdf p. 2: 4-3/4"-18" (121-457 mm); `COMBO_OVEN.sillIn`.
  MEM301WS: { min: 4.75, max: 18 },
};

/**
 * Package D's oven height in Layout (12b): 5" to 18" by the inch, and within
 * that what the chosen oven's own sheet allows (Leo, 2026-11-16, C, 乙:
 * 「换型号时范围跟着型号变」 — PO302W to 14"; ME301YP's sheet allows 38" and the
 * slider still stops at 18"). An oven with no range here keeps the slider's.
 */
export const STEAM_SILL_LIMITS = { min: 5, max: 18, step: 1 } as const;

export function ovenSillLimits(oven: Pick<Appliance, "model"> | undefined): { min: number; max: number; step: number } {
  const sheet = oven ? OVEN_SILL_RANGE_IN[oven.model] : undefined;
  if (!sheet) return { ...STEAM_SILL_LIMITS };
  return {
    min: Math.max(STEAM_SILL_LIMITS.min, Math.ceil(sheet.min)),
    max: Math.min(STEAM_SILL_LIMITS.max, Math.floor(sheet.max)),
    step: STEAM_SILL_LIMITS.step,
  };
}

/**
 * Where D's opening starts for the height asked: what was asked, held to the
 * chosen oven's ends. Held is a real answer rather than an error, as B's
 * microwave handle is (`comboSillFor`): the slider keeps what was asked, the
 * tower is built at the end, and the install list says so (Leo, C: 「和 B 的
 * 滑杆到头停住并提示是同一种做法」).
 */
export function steamSillFor(askedIn: number, oven: Pick<Appliance, "model"> | undefined): { sillIn: number; held: boolean } {
  const { min, max } = ovenSillLimits(oven);
  const sillIn = Math.min(max, Math.max(min, askedIn));
  return { sillIn, held: sillIn !== askedIn };
}

/**
 * What holds an oven on its height short of what was asked, for the install list's words —
 * one rule (Leo, 2026-11-19: 「被规格表挡住用 12b 那句，被滑杆上限挡住用这句」, 「不能再出现"停在的高度"和
 * "允许的范围"对不上的句子」): its own sheet, 12b's sentence with the sheet's range, where the sheet's
 * whole inches stop at or below the slider's ends (PO302W at 14", PODS302B at 18"); the slider's
 * top where the sheet would let it go higher (ME301YP, to 38"), 「这里最高调到 18″」 with the 18 read
 * from `STEAM_SILL_LIMITS` (「句子里的 18 从滑杆的上限那一处读，不要另写一个 18」). Null when not held.
 */
export function towerHeldBy(oven: Pick<Appliance, "model"> | undefined, askedIn: number): "sheet" | "slider" | null {
  const { sillIn, held } = steamSillFor(askedIn, oven);
  if (!held) return null;
  const sheet = oven ? OVEN_SILL_RANGE_IN[oven.model] : undefined;
  if (!sheet) return "slider";
  if (sillIn < askedIn) return Math.floor(sheet.max) <= STEAM_SILL_LIMITS.max ? "sheet" : "slider";
  return Math.ceil(sheet.min) >= STEAM_SILL_LIMITS.min ? "sheet" : "slider";
}

/**
 * Every oven tower's height, one rule (12e; Leo, 2026-11-18: 「烤箱有微波门就调微波把手，没有微波门就调切口底」,
 * every package, D's L and U with MEM301WS too). Asked here and nowhere else: the opening
 * `sillFor` builds, the switch of oven (`setOvenModel`), the slider Layout shows, and the
 * install list's lines when the oven cannot go where asked.
 *
 * A tower keeps one figure asked, its own: the microwave handle in a combination tower (B,
 * E, D on one wall), less 39" for the opening; the oven height in D's double-oven tower
 * (12b). Whichever slider shows writes that one figure, so the height is handed over from
 * oven to oven and kept when an oven holds it short (Leo, 1: 「高度接过去……换回去也回到同一个高度。
 * 我要的高度记着」), every tower starts where its oven stands (2: B, E and D on one wall 15"),
 * and an old link, which carries that same figure, opens where the oven was (3).
 */
export type TowerKind = "combo" | "double";
export type TowerHang = "handle" | "height";

/** Which slider an oven hangs from: its microwave handle if it has a microwave door, else the opening's height. */
export function towerHang(oven: Pick<Appliance, "installType"> | undefined, kind: TowerKind): TowerHang {
  if (!oven) return kind === "combo" ? "handle" : "height";
  return isCombo(oven as Appliance) ? "handle" : "height";
}

/** The opening asked for: the tower's own figure, the handle's less 39" in a combination tower. */
export function askedSillIn(kind: TowerKind, params: { microwaveHandleIn: number; steamSillIn: number }): number {
  return kind === "double" ? params.steamSillIn : params.microwaveHandleIn - COMBO_OVEN.microwaveHandleIn;
}

/** The figure a slider writes back for an opening asked: into the tower's own parameter. */
export function towerParamsFor(kind: TowerKind, askedIn: number): { microwaveHandleIn: number } | { steamSillIn: number } {
  return kind === "double" ? { steamSillIn: askedIn } : { microwaveHandleIn: askedIn + COMBO_OVEN.microwaveHandleIn };
}

/**
 * Where the opening starts for the oven chosen, and whether it is held short of what was
 * asked: a microwave door's oven by its drawing (`comboSillFor`), any other by its own
 * sheet (`steamSillFor`, 12b).
 */
export function towerSillFor(
  kind: TowerKind,
  params: { microwaveHandleIn: number; steamSillIn: number },
  oven: Appliance | undefined,
): { hang: TowerHang; sillIn: number; held: boolean; askedIn: number } {
  const askedIn = askedSillIn(kind, params);
  if (towerHang(oven, kind) === "handle") {
    const { sillIn, clamped } = comboSillFor(askedIn + COMBO_OVEN.microwaveHandleIn);
    return { hang: "handle", sillIn, held: clamped, askedIn };
  }
  return { hang: "height", ...steamSillFor(askedIn, oven), askedIn };
}

/** A tower's kind, from its slot as the package builds it; null for any other slot. */
export const towerKindOf = (spec: Pick<PackageSlot, "category" | "installType"> | undefined): TowerKind | null =>
  spec?.category === "wall-oven" && (spec.installType === "combo" || spec.installType === "double") ? spec.installType : null;

/** The tower's slot as the chosen oven is built in: its opening's height. Any other slot as it is. */
export function towerSlotAsBuilt(pkg: Package, spec: PackageSlot): PackageSlot {
  if (!isOvenTower(spec) || spec.heightIn === null || spec.heightIn === undefined) return spec;
  const heightIn = towerOpeningHeightIn(spec.heightIn, towerOvenFor(pkg));
  return heightIn === spec.heightIn ? spec : { ...spec, heightIn };
}
