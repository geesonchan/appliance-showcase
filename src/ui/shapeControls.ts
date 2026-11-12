import { LAYOUT_SHAPES, type LayoutShape } from "../data/layoutShape";
import { paramLimitsFor, type LayoutParams } from "../data/layoutTemplate";
import type { AccentRun } from "../store/finishes";

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

/**
 * The U's (U-2; docs/plans/u2-plan.md, section 2): one wall's, the side walls'
 * one slider (Leo, 2026-11-11: 「左右墙一根滑杆管两面」) and the corner, one
 * choice for both of its corners. What the U decides itself — which leg the
 * refrigerator, the sink and the coffee go on, the tower's side, the island —
 * is hidden, and the L's own choice kept for the L (`asBuilt`).
 */
export const SHOWN_IN_U: readonly LayoutControl[] = [...SHOWN_ON_ONE_WALL, "leftWallIn", "cornerType"];

/** Whether the Layout tab shows a control in a shape. */
export const showsControl = (shape: LayoutShape, control: LayoutControl) =>
  shape === "L" || (shape === "U" ? SHOWN_IN_U : SHOWN_ON_ONE_WALL).includes(control);

/**
 * The side wall slider's name: the L's left wall, the U's two side walls as one
 * (Leo, 2026-11-11: 「叫"左右墙长度 / Side walls"」).
 */
export const sideWallLabelKey = (shape: LayoutShape) => (shape === "U" ? "panel.room.sideWalls" : "panel.room.leftWall");

/** Where that slider stops: the shape's own limits, the U's sides at D13's 216". */
export const sideWallLimits = (shape: LayoutShape) => paramLimitsFor(shape).leftWallIn;

/** The wall a grown-wall notice names: in a U the left wall is both side walls. */
export const wallToastKey = (key: "backWallIn" | "leftWallIn", shape: LayoutShape) =>
  key === "backWallIn" ? "toast.wall.back" : shape === "U" ? "toast.wall.sides" : "toast.wall.left";

/**
 * The runs the accent colour can go on (Finishes panel): one wall's one run,
 * the whole of it (round 98b-2); the L's two legs and its island; the U's three
 * legs (U-2), with no island.
 */
export function accentRunsFor(shape: LayoutShape): AccentRun[] {
  if (shape === "one-wall") return ["none", "back"];
  if (shape === "U") return ["none", "left", "back", "right"];
  return ["none", "left", "back", "island"];
}

/**
 * The shape buttons in the top bar (U-2, A; Leo, 2026-11-11: 「形状开关放到主界面，
 * 像套餐 A–E 那样一排按钮」): the short names on the buttons (「L 型 / 一字型 /
 * U 型」, 9.3), the long ones on their titles. The Layout tab has no switch of
 * its own since (his answer 1: 「右边面板的形状开关拿掉，只留主界面那一排」).
 */
export const shapeButtons = () =>
  LAYOUT_SHAPES.map((shape) => ({ value: shape, labelKey: `topbar.shape.${shape}`, titleKey: `panel.layout.shape.${shape}` }));
