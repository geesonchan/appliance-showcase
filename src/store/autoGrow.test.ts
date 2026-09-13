import { afterAll, describe, expect, it } from "vitest";
import { inchesSpoken } from "../data/inches";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  generateLayout,
  wallRequirement,
  type LayoutParams,
} from "../data/layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "../data/packages";
import { useAppStore } from "./useAppStore";

/**
 * A switch that needs more wall gets it. Round 34, Leo.
 *
 * Every switch in the layout panel, flipped on its own in every package, from
 * the room the package opens in and from the tightest room it can be built in.
 * The room grows only as far as the change needs, says so with an Undo, and
 * Undo puts back exactly what was there. The wall sliders still refuse, and so
 * does anything that would take a wall past 204".
 */
const store = () => useAppStore.getState();
const WALLS = ["backWallIn", "leftWallIn"] as const;
const LEG = { backWallIn: "back", leftWallIn: "left" } as const;
const PACKAGES = ["package-a", "package-b", "package-c", "package-d"];
const flip = <T,>(value: T, a: T, b: T) => (value === a ? b : a);

/** Every discrete switch in the layout panel, flipped from where the room is. */
function switches(room: LayoutParams): [string, Partial<LayoutParams>][] {
  return [
    ["fridgeEnd", { fridgeEnd: flip(room.fridgeEnd, "left", "back") }],
    ["fridgeEndAbuts", { fridgeEndAbuts: flip(room.fridgeEndAbuts, "cabinet", "wall") }],
    ["sinkLeg", { sinkLeg: flip(room.sinkLeg, "left", "back") }],
    ["cornerType", { cornerType: flip(room.cornerType, "blind", "lazy-susan") }],
    ["housingStyle", { housingStyle: flip(room.housingStyle, "box", "sweep") }],
    ["towerSide", { towerSide: flip(room.towerSide, "left", "right") }],
    ["coffeeLeg", { coffeeLeg: flip(room.coffeeLeg, "left", "back") }],
    ["hasIsland", { hasIsland: !room.hasIsland }],
    ["islandOrientation", { islandOrientation: flip(room.islandOrientation, "parallel", "perpendicular") }],
    ["sinkUnderWindow", { sinkUnderWindow: !room.sinkUnderWindow }],
    ["windows", { windows: room.windows.length > 0 ? [] : DEFAULT_PARAMS.windows }],
  ];
}

/** What a flip asks for once the store's sink-and-refrigerator rule has had its say. */
function asked(room: LayoutParams, patch: Partial<LayoutParams>): LayoutParams {
  const next = { ...room, ...patch };
  if (next.fridgeEnd === next.sinkLeg) {
    if (patch.fridgeEnd) next.sinkLeg = flip(next.sinkLeg, "left", "back");
    else if (patch.sinkLeg) next.fridgeEnd = flip(next.fridgeEnd, "left", "back");
  }
  return next;
}

/** More wall than the slider has, on either leg. */
const extreme = (params: LayoutParams) =>
  WALLS.some((key) => wallRequirement(params, LEG[key]).minimumIn > PARAM_LIMITS[key].max);

/** The package's own room, reached the way a customer reaches it. */
function openPackage(id: string): LayoutParams {
  store().setPackageId(DEFAULT_PACKAGE.id);
  store().setLayout({ ...DEFAULT_PARAMS });
  store().setPackageId(id);
  store().dismissToast();
  expect(store().packageId, id).toBe(id);
  expect(store().layoutIssues, id).toEqual([]);
  return store().layoutParams;
}

afterAll(() => {
  store().setPackageId(DEFAULT_PACKAGE.id);
  store().setLayout({ ...DEFAULT_PARAMS });
  store().dismissToast();
});

describe("a switch that needs more wall", () => {
  it("never refuses or grows from a package's own room, bar the three that need more than 204 inches", () => {
    const refused: string[] = [];
    for (const id of PACKAGES) {
      const room = openPackage(id);
      for (const [name, patch] of switches(room)) {
        const where = `${id} ${name}`;
        const wants = asked(room, patch);
        store().setLayout(patch);
        if (extreme(wants)) {
          // Refused, with the reason it always gave, and the room left standing.
          expect(store().layoutIssues.map((r) => r.key), where).toContain("refusal.wallShort");
          expect(store().toast?.key, where).not.toBe("toast.wallGrew");
          refused.push(where);
        } else {
          expect(store().layoutIssues, where).toEqual([]);
          // The package's room already has the slack this switch needs.
          for (const key of WALLS) expect(store().layoutParams[key], `${where} ${key}`).toBe(room[key]);
          expect(store().toast?.key, where).not.toBe("toast.wallGrew");
        }
        store().setLayout({ ...room });
        store().dismissToast();
        expect(store().layoutIssues, `${where}, put back`).toEqual([]);
      }
    }
    // Package D's columns or its coffee cabinet on the back wall: 207-1/2" and
    // 224-1/4" of run. The sink on the left leg pushes the columns across too.
    expect(refused.sort()).toEqual(["package-d coffeeLeg", "package-d fridgeEnd", "package-d sinkLeg"]);
  });

  it("grows each wall to exactly what the change needs from the tightest room, and Undo puts it all back", () => {
    let grewAtAll = 0;
    for (const id of PACKAGES) {
      const room = openPackage(id);
      // The shortest walls this room will build at.
      const tight: LayoutParams = {
        ...room,
        backWallIn: wallRequirement(room, "back").minimumIn,
        leftWallIn: wallRequirement(room, "left").minimumIn,
      };
      store().setLayout(tight);
      expect(store().layoutIssues, `${id} at its minimum`).toEqual([]);

      for (const [name, patch] of switches(tight)) {
        const where = `${id} ${name}`;
        const wants = asked(tight, patch);
        store().dismissToast();
        store().setLayout(patch);

        if (extreme(wants)) {
          expect(store().layoutIssues.map((r) => r.key), where).toContain("refusal.wallShort");
          store().setLayout(tight);
          continue;
        }

        expect(store().layoutIssues, where).toEqual([]);
        const now = store().layoutParams;
        // Every switch is what was asked for...
        for (const key of Object.keys(wants) as (keyof LayoutParams)[]) {
          if (key === "backWallIn" || key === "leftWallIn") continue;
          expect(now[key], `${where} ${key}`).toEqual(wants[key]);
        }
        // ...and each wall is the longer of what it was and what the change
        // needs. "What it needs" is everything that asks for wall — the run,
        // the island standing clear of it, the window — so it is asked of the
        // generator rather than recomputed here: a wall that grew builds where
        // it stopped and does not build an eighth of an inch shorter.
        for (const key of WALLS) {
          if (now[key] === tight[key]) continue;
          expect(now[key], `${where} ${key} shrank`).toBeGreaterThan(tight[key]);
          expect(generateLayout(now).ok, `${where} ${key}`).toBe(true);
          expect(
            generateLayout({ ...now, [key]: now[key] - 1 / 8 }).ok,
            `${where} ${key} grew further than it needed to`,
          ).toBe(false);
        }

        const grew = WALLS.some((key) => now[key] !== tight[key]);
        if (grew) {
          grewAtAll += 1;
          expect(store().toast?.key, where).toBe("toast.wallGrew");
          expect(store().toast?.undo, where).toBeTruthy();
          store().undo();
          expect(store().layoutParams, `${where}, undone`).toEqual(tight);
          expect(store().layoutIssues, `${where}, undone`).toEqual([]);
          expect(store().toast, `${where}, undone`).toBeNull();
        } else {
          expect(store().toast?.key, where).not.toBe("toast.wallGrew");
          store().setLayout(tight);
        }
      }
    }
    // The test has to have made a room grow, or it has proved nothing.
    expect(grewAtAll).toBeGreaterThan(0);
  });

  it("says which wall grew, from what to what, and why, in the words a customer hears", () => {
    const room = openPackage("package-d");
    store().setLayout({ ...room, leftWallIn: 175.25 });
    expect(store().layoutIssues).toEqual([]);
    store().dismissToast();

    store().setLayout({ fridgeEndAbuts: "wall" });
    expect(store().layoutIssues).toEqual([]);
    expect(store().layoutParams.leftWallIn).toBe(178.75);
    expect(store().toast?.lines).toEqual([
      {
        key: "toast.wallGrew",
        vars: {
          wallKey: "toast.wall.left",
          fromIn: "175¼″",
          toIn: "178¾″",
          reasonKey: "toast.growReason.fridgeEndAbuts",
        },
      },
    ]);

    store().undo();
    expect(store().layoutParams.leftWallIn).toBe(175.25);
    expect(store().layoutParams.fridgeEndAbuts).toBe("cabinet");
    expect(inchesSpoken(201.375)).toBe("201⅜″");
    expect(inchesSpoken(168)).toBe("168″");
  });

  it("still refuses a wall slider dragged below what the room needs", () => {
    const room = openPackage("package-d");
    store().setLayout({ leftWallIn: 150 });
    expect(store().layoutIssues.map((r) => r.key)).toContain("refusal.wallShort");
    // The slider shows what was dragged to, and nothing grew behind its back.
    expect(store().layoutParams.leftWallIn).toBe(150);
    expect(store().toast?.key).not.toBe("toast.wallGrew");
    store().setLayout({ ...room });
    expect(store().layoutIssues).toEqual([]);
  });
});

describe("a package's own room", () => {
  it("opens package D with the left wall its return-wall switch needs", () => {
    const room = openPackage("package-d");
    expect(room.leftWallIn).toBeGreaterThanOrEqual(178.75);
    expect(room.backWallIn).toBe(201.75);
  });

  it("never shrinks a room somebody made bigger when a package is chosen", () => {
    const a = openPackage("package-a");
    const d = PACKAGE_BY_ID["package-d"];
    // A left wall longer than D's own default, and one both packages can build
    // along that leg — so the only thing that could shorten it is the switch.
    const leftIn = Math.min(
      wallRequirement(a, "left").maximumIn,
      wallRequirement({ ...a, ...d.defaultLayout }, "left", d).maximumIn,
    );
    expect(leftIn, "no left wall both packages take that is longer than D's default").toBeGreaterThan(
      d.defaultLayout.leftWallIn!,
    );
    store().setLayout({ leftWallIn: leftIn });
    expect(store().layoutIssues).toEqual([]);

    store().setPackageId("package-d");
    expect(store().layoutIssues).toEqual([]);
    expect(store().layoutParams.leftWallIn).toBe(leftIn);
    // And the wall that was shorter than D asks for is brought up to it.
    expect(store().layoutParams.backWallIn).toBeGreaterThanOrEqual(d.defaultLayout.backWallIn!);
  });

  it("offers Undo when choosing a package grew the room, and puts back the package and the room", () => {
    const room = openPackage("package-a");
    const selection = store().selection;
    store().setPackageId("package-d");
    expect(store().toast?.key).toBe("toast.roomGrew");
    expect(store().toast?.undo?.packageId).toBe("package-a");
    store().undo();
    expect(store().packageId).toBe("package-a");
    expect(store().layoutParams).toEqual(room);
    expect(store().selection).toEqual(selection);
    expect(store().layoutIssues).toEqual([]);
  });
});
