import type { LayoutShape } from "../data/layoutShape";
import type { LayoutParams } from "../data/layoutTemplate";

/**
 * Which of the Layout tab's controls a shape shows, by the setting each sets.
 * Round 98b-2 (docs/plans/round-98b2-plan.md, section 2).
 *
 * The L shows every one. One wall hides what it does not have — a second leg
 * for the refrigerator, the sink or the coffee cabinet to go on, a corner, an
 * island and its sizes, the room's depth — and what it decides itself: the
 * tower beside the cooking surface on the refrigerator's side, the
 * refrigerator's outer side against the wall (Leo, round 98, second and third
 * batches; round 98b). What it shows reads a setting one wall leaves as asked,
 * so the control and the room agree (`shapeControls.test.ts` holds it to
 * `ONE_WALL_SETS`).
 */
export type LayoutControl = keyof Pick<
  LayoutParams,
  | "fridgeEnd"
  | "fridgeEndAbuts"
  | "sinkLeg"
  | "cornerType"
  | "housingStyle"
  | "towerSide"
  | "coffeeLeg"
  | "hasIsland"
  | "islandOrientation"
  | "backWallIn"
  | "leftWallIn"
  | "microwaveHandleIn"
  | "coffeeSillIn"
  | "islandLengthIn"
  | "islandDepthIn"
  | "aisleIn"
>;

export const SHOWN_ON_ONE_WALL: readonly LayoutControl[] = ["housingStyle", "backWallIn", "microwaveHandleIn", "coffeeSillIn"];

/** Whether the Layout tab shows a control in a shape. */
export const showsControl = (shape: LayoutShape, control: LayoutControl) =>
  shape === "L" || SHOWN_ON_ONE_WALL.includes(control);
