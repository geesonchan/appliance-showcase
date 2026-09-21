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
 * does anything that would take a wall past 240" (204" until round 35).
 */
const store = () => useAppStore.getState();
const WALLS = ["backWallIn", "leftWallIn"] as const;
const LEG = { backWallIn: "back", leftWallIn: "left" } as const;
const PACKAGES = ["package-a", "package-b", "package-c", "package-d", "package-e"];

/**
 * The one single switch a package's own room is allowed not to have slack
 * for, and why. Round 69, Leo: package E opens at 180" x 168" — 180" so the
 * corner can go to a lazy susan without growing, 168" as D20 set the room.
 * Moving its coffee cabinet to the left leg takes the combination oven with it
 * (both towers stand on one leg, round 55) onto the leg with the column bank,
 * and that asks 176-1/8"; the wall grows, with its toast and its Undo, rather
 * than every E room opening eight inches deeper for one rare switch.
 */
const GROWS_FROM_OWN_ROOM: Record<string, string[]> = { "package-e": ["coffeeLeg"] };

/**
 * Switches a package refuses whatever the walls, with the one reason it gives.
 * Package E cooks in the island, so it has no room without one (D20,
 * `refusal.cooktopIsland`): growing a wall is not the answer to that.
 */
const REFUSED_BY_DESIGN: Record<string, Record<string, string>> = {
  "package-e": { hasIsland: "refusal.cooktopIsland" },
};
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
  it("never refuses or grows from a package's own room, whichever single switch is flipped", () => {
    const refused: string[] = [];
    for (const id of PACKAGES) {
      const room = openPackage(id);
      for (const [name, patch] of switches(room)) {
        const where = `${id} ${name}`;
        const wants = asked(room, patch);
        store().setLayout(patch);
        const byDesign = REFUSED_BY_DESIGN[id]?.[name];
        if (byDesign) {
          expect(store().layoutIssues.map((r) => r.key), where).toEqual([byDesign]);
        } else if (extreme(wants)) {
          // Refused, with the reason it always gave, and the room left standing.
          expect(store().layoutIssues.map((r) => r.key), where).toContain("refusal.wallShort");
          expect(store().toast?.key, where).not.toBe("toast.wallGrew");
          refused.push(where);
        } else if (GROWS_FROM_OWN_ROOM[id]?.includes(name)) {
          // Allowed to grow, and it must: built, with the growth announced.
          expect(store().layoutIssues, where).toEqual([]);
          expect(store().toast?.key, where).toBe("toast.wallGrew");
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
    // Round 34 refused three of package D's: its columns or its coffee cabinet
    // on the back wall needed 207-1/2" and 224-1/4" against a 204" slider.
    // Since round 35's 240" slider nothing a single switch asks for is past it.
    expect(refused).toEqual([]);
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

        const byDesign = REFUSED_BY_DESIGN[id]?.[name];
        if (byDesign) {
          expect(store().layoutIssues.map((r) => r.key), where).toEqual([byDesign]);
          store().setLayout(tight);
          continue;
        }
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
  it("opens package D with the walls every one of its switches needs", () => {
    const room = openPackage("package-d");
    // The coffee cabinet on the back wall needs 224-1/4" of it; the columns on
    // the back leg need 207-1/2" there. The left wall is the return wall's
    // 178-3/4". Round 35 to 60 it was 178-7/8", an eighth more "for the window
    // to sit evenly" — which was the quarter-inch window step, not the room
    // (D18, round 61).
    expect(room.backWallIn).toBe(224.25);
    expect(room.leftWallIn).toBe(178.75);
  });

  it("grows rather than refuses the columns onto the back leg, window and all", () => {
    const room = openPackage("package-d");
    store().setLayout({ ...room, backWallIn: 201.75, leftWallIn: 178.75 });
    expect(store().layoutIssues).toEqual([]);
    store().dismissToast();
    store().setLayout({ fridgeEnd: "back" });
    expect(store().layoutIssues).toEqual([]);
    expect(store().layoutParams.fridgeEnd).toBe("back");
    expect(store().layoutParams.sinkLeg).toBe("left");
    expect(store().layoutParams.backWallIn).toBe(207.5);
    // Round 60: the left wall stays at 178-3/4". Until then it grew an eighth,
    // to 178-7/8", and the toast said it was for the refrigerator. It was for
    // the window, which slid a quarter inch at a time and could not come out
    // even on a wall that left its two gaps an odd number of quarters apart.
    expect(store().layoutParams.leftWallIn).toBe(178.75);
    expect(store().toast?.lines?.map((line) => line.vars?.wallKey)).toEqual(["toast.wall.back"]);
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

  /**
   * Round 60, Leo. Choosing a package can change the room two ways: its own
   * arrangement (B puts the sink on the left leg and the refrigerator on the
   * back) and the length of a wall. Only the second is the room growing. From
   * D's room to B, not an inch of wall moves, and the app used to say "Package B
   * needs a longer run: the room is now 224.3″ across the back and 178.9″ down
   * the left" — D's own walls.
   */
  it("says nothing about the room growing when choosing a package moves no wall", () => {
    openPackage("package-d");
    store().setPackageId("package-b");
    expect(store().packageId).toBe("package-b");
    expect(store().toast).toBeNull();
  });

  it("takes down the last package's growth toast when the next choice grows nothing", () => {
    // A to D grows the room and says so; B straight after grows nothing. D's
    // sentence, and its Undo back to A, are not about the room on screen.
    openPackage("package-a");
    store().setPackageId("package-d");
    expect(store().toast?.key).toBe("toast.roomGrew");
    store().setPackageId("package-b");
    expect(store().toast).toBeNull();
  });

  it("keeps D's walls when choosing B from D's room", () => {
    const d = openPackage("package-d");
    store().setPackageId("package-b");
    expect({ back: store().layoutParams.backWallIn, left: store().layoutParams.leftWallIn }).toEqual({
      back: d.backWallIn,
      left: d.leftWallIn,
    });
  });

  it("still says so when choosing B from A's room really lengthens the back wall, arrangement and all", () => {
    openPackage("package-a");
    store().setPackageId("package-b");
    expect(store().toast?.key).toBe("toast.roomGrew");
    expect(store().toast?.vars).toMatchObject({ backIn: 202.4, leftIn: 144 });
  });

  /**
   * Round 63. The same refusal, met on a switch: A's room with a lazy susan and
   * a 158-7/8" left wall, chosen as B, was refused at that wall for the sink
   * standing "6" from the window, 6" allowed", and the last fallback in
   * `setActivePackage` then sized the room to B's bare minimum — the left wall
   * from 158-7/8" to 120".
   */
  it("keeps the left wall when choosing B from a lazy-susan room at 158-7/8\"", () => {
    openPackage("package-a");
    store().setLayout({ cornerType: "lazy-susan", leftWallIn: 158.875 });
    expect(store().layoutIssues).toEqual([]);
    store().dismissToast();
    store().setPackageId("package-b");
    expect(store().packageId).toBe("package-b");
    expect(store().layoutParams.leftWallIn).toBe(158.875);
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
