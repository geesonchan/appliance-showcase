import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { APPLIANCE_BY_ID, SLOT_ORDER } from "./catalogue";
import { doorFace } from "./doorFace";
import { FIXTURE_BY_ID } from "./fixtures";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { resetRoom } from "./testRoom";
import { PACKAGE_BY_ID } from "./packages";
import { planFootprint } from "./planFootprint";
import { ISLAND, REQUESTED_PARAMS, runForSlot } from "./room";
import { leaderEnd, resolveRoughIn } from "./roughIn";
import { SLOT_BY_ID, isOmitted } from "./slots";
import { wallAnchor } from "./wallAnchor";

/**
 * D22 step 2, round 50: the four places that guessed which way a thing faced,
 * each held to something outside the code that draws it.
 *
 * Nothing here reads a facing the code worked out. Which way the island runs is
 * which of its plan extents is longer; its working side is the lower coordinate
 * across it and the seats the higher; a run's cabinetry faces away from the wall
 * it stands on, which is +z on the back wall and +x on the left one; and which
 * run a machine is on is which run's segments carry it.
 */
afterAll(() => {
  resetRoom();
});

const EPS = 1e-6;
const inches = (feet: number) => feet * 12;

function build(id: string, islandOrientation: "parallel" | "perpendicular") {
  resetRoom();
  expect(setActivePackage(id).ok).toBe(true);
  expect(setLayoutParamsGrowing({ ...REQUESTED_PARAMS, islandOrientation }).ok).toBe(true);
  expect(ISLAND.present).toBe(true);
}

/** The island in its own terms, from its extents alone. */
function island() {
  const alongIsX = ISLAND.x[1] - ISLAND.x[0] > ISLAND.z[1] - ISLAND.z[0];
  const across = alongIsX ? ISLAND.z : ISLAND.x;
  return { alongIsX, acrossIndex: alongIsX ? 2 : 0, across: [Math.min(...across), Math.max(...across)] };
}

const CASES = ["package-a", "package-c", "package-d"].flatMap((id) =>
  (["parallel", "perpendicular"] as const).map((orientation) => [id, orientation] as const),
);

/**
 * Every island opening in packages A, C and D is 24" by 24", so a footprint with
 * its width and depth swapped looks exactly like the right one — the first run of
 * this file passed the plan thumbnail on the old code for that reason, not
 * because it was right. The cooktop's 36" by 24" is the one island slot that
 * shows it, so the thumbnail is checked on a package that has one.
 */
const COOKTOP_ID = "test-island-facing-cooktop";

function registerCooktopPackage() {
  const d = PACKAGE_BY_ID["package-d"];
  const { "slot-microwave": _dropped, ...selection } = d.defaultSelection;
  PACKAGE_BY_ID[COOKTOP_ID] = {
    ...d,
    id: COOKTOP_ID,
    // Round 56: a cooktop island has a 48" aisle (D20), and choosing a
    // package whose island has a cooktop at the ordinary 42" is now refused.
    defaultLayout: { ...d.defaultLayout, aisleIn: 48 },
    slots: [
      ...d.slots.filter((slot) => slot.slotId !== "slot-microwave"),
      {
        slotId: "slot-cooktop",
        category: "cooktop",
        widthIn: 36,
        heightIn: null,
        depthIn: null,
        installType: "drop-in",
        builtForCooktopIn: null,
        tallUnit: false,
        beside: null,
        sillIn: 0,
        standsOver: null,
        enclosure: false,
        panelReady: null,
        bestView: null,
        utilities: { gas: null, power: { voltage: 240, amps: 50, dedicated: true }, duct: null },
      },
    ],
    defaultSelection: { ...selection, "slot-cooktop": "thermador-cit367yg" },
  };
}

describe.each(["parallel", "perpendicular"] as const)(
  "a cooktop island laid %s, on the plan thumbnail",
  (orientation) => {
    it("draws the 36 inch cooktop 36 inches along the island, not across it", () => {
      registerCooktopPackage();
      build(COOKTOP_ID, orientation);
      const { alongIsX } = island();
      const slot = SLOT_BY_ID["slot-cooktop"];
      expect(slot.cutout.w).not.toBe(slot.cutout.d);
      const got = planFootprint(slot);
      const along = inches(alongIsX ? got.w : got.h);
      const across = inches(alongIsX ? got.h : got.w);
      expect([along, across]).toEqual([slot.cutout.w, slot.cutout.d]);
      // Leave the room on a package that still exists before removing this one.
      resetRoom();
      delete PACKAGE_BY_ID[COOKTOP_ID];
    });
  },
);

describe.each(CASES)("%s with its island laid %s", (id, orientation) => {
  it("draws every door on a face somebody can see", () => {
    build(id, orientation);
    const { acrossIndex, across } = island();
    const wrong: string[] = [];
    for (const box of CABINETS) {
      if (box.kind === "counter" || box.kind === "toe" || box.installOnly) continue;
      const face = doorFace(box);
      const index = face.axis === "x" ? 0 : 2;
      const plane = box.position[index] + (face.sign * box.size[index]) / 2;
      if (box.run === "island") {
        // On one of the island's two long faces, not inside it or on an end.
        const onAFace =
          index === acrossIndex && (Math.abs(plane - across[0]) < EPS || Math.abs(plane - across[1]) < EPS);
        if (!onAFace) wrong.push(`${box.id}: door on ${face.sign > 0 ? "+" : "-"}${face.axis} at ${plane.toFixed(3)}`);
      } else {
        // Facing the room: away from the back wall on the back run, from the left wall on the left one.
        const want = box.run === "back" ? "z" : "x";
        if (face.axis !== want || face.sign !== 1) {
          wrong.push(`${box.id} (${box.run} run): door on ${face.sign > 0 ? "+" : "-"}${face.axis}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("draws each machine on the plan with its width along the run or the island it is on", () => {
    build(id, orientation);
    const { alongIsX } = island();
    const wrong: string[] = [];
    for (const slotId of SLOT_ORDER) {
      if (slotId === "slot-hood" || isOmitted(slotId)) continue;
      const slot = SLOT_BY_ID[slotId];
      const onX =
        slot.mount === "island" ? alongIsX : runForSlot(slotId) === "back";
      const want = onX
        ? { w: slot.cutout.w, h: slot.cutout.d }
        : { w: slot.cutout.d, h: slot.cutout.w };
      const got = planFootprint(slot);
      if (Math.abs(inches(got.w) - want.w) > EPS || Math.abs(inches(got.h) - want.h) > EPS) {
        wrong.push(`${slotId}: ${inches(got.w)} x ${inches(got.h)}, wants ${want.w} x ${want.h}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("runs every island rough-in leader out of the island on the side its machine opens to", () => {
    build(id, orientation);
    const { acrossIndex, across } = island();
    const selection = PACKAGE_BY_ID[id].defaultSelection as Record<string, string>;
    const wrong: string[] = [];
    let checked = 0;
    for (const slotId of SLOT_ORDER) {
      if (isOmitted(slotId) || SLOT_BY_ID[slotId].mount !== "island") continue;
      const slot = SLOT_BY_ID[slotId];
      // Which side it opens to: the half of the island it stands in.
      const opensLow = slot.position[acrossIndex] < (across[0] + across[1]) / 2;
      for (const resolved of resolveRoughIn(slotId, APPLIANCE_BY_ID[selection[slotId]])) {
        checked += 1;
        const end = leaderEnd(resolved)[acrossIndex];
        const out = opensLow ? end < across[0] - EPS : end > across[1] + EPS;
        if (!out) {
          wrong.push(
            `${slotId} ${resolved.point.type}: ends at ${end.toFixed(2)}, island ${across[0].toFixed(2)}..${across[1].toFixed(2)}`,
          );
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  it("gives a wall anchor to what is on a wall and none to what is in the island", () => {
    build(id, orientation);
    const wrong: string[] = [];
    for (const slotId of SLOT_ORDER) {
      if (isOmitted(slotId)) continue;
      const slot = SLOT_BY_ID[slotId];
      const anchor = wallAnchor(slot, 0);
      if (slot.mount === "island") {
        if (anchor !== null) wrong.push(`${slotId}: in the island, anchored to a wall`);
        continue;
      }
      const onLeft = runForSlot(slotId) === "left";
      if (!anchor || anchor.onLeftWall !== onLeft) {
        wrong.push(`${slotId}: on the ${onLeft ? "left" : "back"} run, anchored ${anchor ? (anchor.onLeftWall ? "left" : "back") : "nowhere"}`);
      }
    }
    const sink = FIXTURE_BY_ID["fixture-sink"];
    const sinkAnchor = wallAnchor(sink, 0);
    expect(sinkAnchor, "the sink").not.toBeNull();
    expect(wrong).toEqual([]);
  });
});
