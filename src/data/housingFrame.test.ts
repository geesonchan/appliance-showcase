/**
 * The housing round an insert liner, turned with its run (U-2; Leo, 2026-11-11:
 * 「B，D套餐的insert hood形状不对」).
 *
 * A cabinet box's size is on the room's axes, `[x, y, z]`; `HoodCabinet` built
 * the housing as though the first of them were always its width along the
 * wall and the last its depth, which is true only of a run along x. On the U's
 * right leg, along z and facing −x, a 36" housing 13" deep was drawn 13" wide
 * and 36" deep, the wrong way round: a board hanging off the wall over a thin
 * strip of steel, its top an open frame. The L and one wall hang it on the back
 * wall, along x, where the two readings agree.
 *
 * So the housing is built in its own frame — width along the run, depth out
 * from the wall — and turned to the way its box faces, as a door is
 * (`doorFace`, `rotationOf`, D22). Checked for B and D, the two packages with a
 * liner, in each shape and each housing style; on the plan the turned housing
 * must cover its box exactly. Reached through the module, so on code without
 * the function each case fails on its own.
 */
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import * as insertHood from "./insertHood";
import { CABINETS, type CabinetBox } from "./cabinets";
import { rotationOf, sizeOnPlan } from "./frame";
import { resetRoom } from "./testRoom";
import { openSharedLink } from "../store/openLink";
import { useAppStore } from "../store/useAppStore";

const OPENED = useAppStore.getState();
const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;
const SIDE: Record<string, number> = { B: 157.5, D: 207 };
const linkFor = (code: string, shape: string, housing: string) =>
  shape === "U"
    ? `?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&housing=${housing}`
    : `?v=2&pkg=${code}&shape=${shape}&housing=${housing}`;

type Frame = { w: number; h: number; d: number; rotationY: number };
const frameOf = (box: CabinetBox): Frame =>
  (insertHood as unknown as { housingFrame: (box: CabinetBox) => Frame }).housingFrame(box);

function housing(code: string, shape: string, style: string) {
  resetRoom();
  useAppStore.setState(OPENED, true);
  openSharedLink(linkFor(code, shape, style));
  const boxes = CABINETS.filter((box) => box.module?.kind === "hood-cabinet");
  if (boxes.length !== 1) throw new Error(`${code} ${shape}: ${boxes.length} housings`);
  return boxes[0];
}

afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

const CASES = ["B", "D"].flatMap((code) =>
  ["L", "one-wall", "U"].flatMap((shape) => ["box", "sweep"].map((style) => [code, shape, style] as const)),
);

describe("the insert liner's housing, in its own frame and turned with its run", () => {
  it.each(CASES)("%s %s %s: 36\" along the run, out from the wall, facing the room", (code, shape, style) => {
    const box = housing(code, shape, style);
    const frame = frameOf(box);
    const [planX, planZ] = sizeOnPlan(frame.rotationY, frame.w, frame.d);
    expect({
      shape: useAppStore.getState().layoutParams.shape,
      style: box.module?.housing,
      wide: inches(frame.w),
      turned: frame.rotationY,
      onPlan: [inches(planX), inches(planZ)],
      height: inches(frame.h),
    }).toEqual({
      shape,
      style,
      wide: 36,
      turned: rotationOf(box.facing),
      onPlan: [inches(box.size[0]), inches(box.size[2])],
      height: inches(box.size[1]),
    });
  });

  it("is what HoodCabinet builds from, never the box's size on the room's axes", () => {
    const source = readFileSync("src/three/HoodCabinet.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect({ frame: source.includes("housingFrame(box)"), size: /box\.size/.test(source) }).toEqual({ frame: true, size: false });
  });

  it("faces −x on the U's right leg, the one place the two readings differ", () => {
    const box = housing("B", "U", "box");
    expect([box.facing.axis, box.facing.sign]).toEqual(["x", -1]);
  });
});
