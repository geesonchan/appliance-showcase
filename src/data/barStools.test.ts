import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { translate } from "../i18n";
import { BAR_STOOL, barStools } from "./barStools";
import { CABINETS } from "./cabinets";
import { counterOutline } from "./counter";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { BUILDABLE_PACKAGES } from "./packages";
import { buildQuote, formatQuote } from "./quote";
import { ISLAND, REQUESTED_PARAMS, RUNS } from "./room";
import { SLOTS, SLOT_BY_ID } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { buildBarStools, furnishingHits } from "../three/barStoolMesh";

/**
 * Bar stools at a seating overhang. Round 77, Leo: a 15" top with nobody at it
 * reads on a phone as a top the cabinets fail to carry.
 *
 * Where a stool stands is judged from the island as drawn — its cabinet boxes
 * and its stone — never from `ISLAND.seating`, which is what the code under
 * test reads. The seating side is the long side away from the perimeter run
 * the island faces: the back run (the lowest z) when the island lies along the
 * back wall, the left run (the lowest x) when it lies across the room. One
 * assertion per test.
 */

function open(id: string, patch: Partial<typeof REQUESTED_PARAMS> = {}) {
  resetRoom();
  const switched = setActivePackage(id);
  if (!switched.ok) throw new Error(`${id} will not build: ${JSON.stringify(switched)}`);
  if (Object.keys(patch).length > 0) {
    const set = setLayoutParams({ ...REQUESTED_PARAMS, ...patch });
    if (!set.ok) throw new Error(`${id} ${JSON.stringify(patch)} refused: ${JSON.stringify(set.reasons)}`);
  }
}

/** The island's cabinets as drawn: min and max on each plan axis, in feet. */
function cabinetExtents() {
  const boxes = CABINETS.filter((b) => b.outline === "island" && b.kind !== "counter" && b.kind !== "toe");
  const span = (i: 0 | 2) => [
    Math.min(...boxes.map((b) => b.position[i] - b.size[i] / 2)),
    Math.max(...boxes.map((b) => b.position[i] + b.size[i] / 2)),
  ];
  return { x: span(0), z: span(2) };
}

/** The island's stone as drawn: its far edge on the seating side, in feet. */
function topFarEdge(axis: "x" | "z") {
  const selection = defaultSelectionOf("package-e");
  const { pieces } = counterOutline(RUNS, undefined, {
    layout: ISLAND,
    slot: SLOT_BY_ID["slot-cooktop"],
    appliance: selection["slot-cooktop"],
  });
  const top = pieces[pieces.length - 1].outline;
  return Math.max(...top.map((p) => (axis === "x" ? p[0] : p[1])));
}

const ORIENTATIONS = [
  // Along the back wall: seats on the side away from the back run, +z.
  { orientation: "parallel" as const, seatAxis: "z" as const, alongAxis: "x" as const },
  // Across the room: seats on the side away from the left run, +x.
  { orientation: "perpendicular" as const, seatAxis: "x" as const, alongAxis: "z" as const },
];
const index = (axis: "x" | "z") => (axis === "x" ? 0 : 2);

beforeEach(() => resetRoom());
afterAll(() => resetRoom());

describe("bar stools: whether there are any, and how many", () => {
  for (const pkg of BUILDABLE_PACKAGES.filter((p) => p.id !== "package-e")) {
    it(`puts none at ${pkg.id}'s island, which has no seating overhang`, () => {
      open(pkg.id);
      expect({ overhangIn: ISLAND.overhangIn, stools: barStools(ISLAND).length }).toEqual({
        overhangIn: 0,
        stools: 0,
      });
    });
  }

  it("puts three at package E's 72 inch island, one per 24 inches", () => {
    open("package-e");
    expect(barStools(ISLAND).length).toBe(3);
  });

  // Not written for E: any island with an overhang gets them. 90" is 3.75
  // seats, so rounding would give four; whole seats only give three.
  it("puts three at package A's island given a 12 inch overhang and 90 inches of length", () => {
    open("package-a", { islandOverhangIn: 12, islandLengthIn: 90, leftWallIn: 168 });
    expect(barStools(ISLAND).length).toBe(3);
  });
});

describe("bar stools stand at the seating side", () => {
  for (const { orientation, seatAxis, alongAxis } of ORIENTATIONS) {
    it(`stands every stool clear of the cabinets on the seating side, island ${orientation}`, () => {
      open("package-e", { islandOrientation: orientation });
      const face = cabinetExtents()[seatAxis][1];
      const stools = barStools(ISLAND);
      const inner = stools.map((s) => (s.position[index(seatAxis)] - face) * 12 - BAR_STOOL.seatDiameterIn / 2);
      expect({ stools: stools.length, touching: inner.filter((d) => d < 0) }).toEqual({ stools: 3, touching: [] });
    });

    it(`pushes every seat partly under the top, island ${orientation}`, () => {
      open("package-e", { islandOrientation: orientation });
      const edge = topFarEdge(seatAxis);
      const face = cabinetExtents()[seatAxis][1];
      const stools = barStools(ISLAND);
      // The seat's centre is under the overhang: past the cabinets' face and
      // inside the stone's edge.
      const outside = stools.filter((s) => {
        const at = s.position[index(seatAxis)];
        return !(at > face && at < edge);
      });
      expect({ stools: stools.length, outside }).toEqual({ stools: 3, outside: [] });
    });

    it(`spaces the stools evenly along the island's own length, island ${orientation}`, () => {
      open("package-e", { islandOrientation: orientation });
      const [from, to] = cabinetExtents()[alongAxis];
      const at = barStools(ISLAND)
        .map((s) => (s.position[index(alongAxis)] - from) * 12)
        .sort((a, b) => a - b);
      const length = (to - from) * 12;
      expect(at.map((v) => Math.round(v * 1000) / 1000)).toEqual([length / 6, length / 2, (5 * length) / 6]);
    });
  }
});

describe("bar stools are furnishing", () => {
  /** A ray straight down through the middle of the first stool's seat. */
  function downOnFirstStool() {
    open("package-e");
    const stools = barStools(ISLAND);
    const group = buildBarStools(stools);
    group.updateMatrixWorld(true);
    const [x, , z] = stools[0].position;
    return { group, ray: new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)) };
  }

  it("takes no ray: a click aimed straight at a seat meets nothing", () => {
    const { group, ray } = downOnFirstStool();
    expect(ray.intersectObject(group, true)).toHaveLength(0);
  });

  it("is still there for the sight-line fade, which asks its geometry", () => {
    const { group, ray } = downOnFirstStool();
    expect(furnishingHits(group, ray).length).toBeGreaterThan(0);
  });

  for (const lang of ["en", "zh"] as const) {
    it(`never reaches package E's quote or its checklist, in ${lang}`, () => {
      open("package-e");
      const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
      const selection = defaultSelectionOf("package-e");
      const { findings } = checklistFor(selection, null);
      const quote = buildQuote({
        packageId: "package-e",
        packageName: "E",
        slots: SLOTS,
        selection,
        blower: null,
        hoodNeedsBlower: false,
        findings,
        t,
      });
      const text = [formatQuote(quote, t), JSON.stringify(quote), JSON.stringify(findings)].join("\n");
      expect({ stools: barStools(ISLAND).length, mentions: text.match(/stool|凳/gi) ?? [] }).toEqual({
        stools: 3,
        mentions: [],
      });
    });
  }
});
