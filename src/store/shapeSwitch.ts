import { inchesSpoken } from "../data/inches";
import type { LayoutParams } from "../data/layoutTemplate";
import type { SlotId } from "../types";
import { wallToastKey } from "../ui/shapeControls";

type Walls = Pick<LayoutParams, "backWallIn" | "leftWallIn">;
export interface NoticeLine {
  key: string;
  vars?: Record<string, string | number>;
}

/** The walls a shape has: one wall its back wall alone; an L and a U both. */
export const wallsOf = (shape: LayoutParams["shape"]) =>
  shape === "one-wall" ? (["backWallIn"] as const) : (["backWallIn", "leftWallIn"] as const);

/**
 * What a shape switch says (U-2; Leo, 2026-11-11, the plan's section 9.3, 4
 * and 5): that the room is now the new shape, and each of its walls that
 * changed, from and to — lengthened, cut to the shape's top, or the L it left
 * put back. Where even the walls' top leaves a machine out, a line names it
 * (「只有加长会超过墙长上限时才省掉东西，提示里写明省了什么」). Null where nothing
 * changed and nothing was left out: no notice.
 */
export function shapeSwitchLines(before: Walls, after: Walls & Pick<LayoutParams, "shape">, omitted: readonly SlotId[]): NoticeLine[] | null {
  const changed = wallsOf(after.shape).filter((key) => Math.abs(after[key] - before[key]) > 1e-9);
  const left = omitted.map((slotId) => ({ key: "toast.shapeOmitted", vars: { itemKey: `slot.${slotId.replace("slot-", "")}` } }));
  if (changed.length === 0) return left.length > 0 ? left : null;
  return [
    { key: "toast.shapeSwitched", vars: { shapeKey: `panel.layout.shape.${after.shape}` } },
    ...wallLines(before, after, changed),
    ...left,
  ];
}

/** A line for each wall that changed: 「{wall}从 {fromIn} 改为 {toIn}」. */
function wallLines(before: Walls, after: Walls & Pick<LayoutParams, "shape">, changed: readonly (keyof Walls)[]): NoticeLine[] {
  return changed.map((key) => ({
    key: "toast.shapeWall",
    vars: { wallKey: wallToastKey(key, after.shape), fromIn: inchesSpoken(before[key]), toIn: inchesSpoken(after[key]) },
  }));
}

/**
 * What a package switch in a U says (Leo, 2026-11-12, on U-2's seven points, 7:
 * 「在 U 里换套餐的提示：只列真正变了的墙，没变的不提，句式和切换形状的提示统一」): the
 * package now on screen, and each wall that changed, in the shape switch's
 * lines. Null where no wall changed: no notice, no Undo (1: 「墙没变时不弹提示，不给
 * 退回」). It was toast.roomGrew.U, which named both walls, the back wall too
 * when it had not moved.
 */
export function packageSwitchLines(packageName: string, before: Walls, after: Walls & Pick<LayoutParams, "shape">): NoticeLine[] | null {
  const changed = wallsOf(after.shape).filter((key) => Math.abs(after[key] - before[key]) > 1e-9);
  if (changed.length === 0) return null;
  return [{ key: "toast.packageSwitched", vars: { package: packageName } }, ...wallLines(before, after, changed)];
}
