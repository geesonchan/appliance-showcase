import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, generateLayout, wallRequirement, type LayoutParams } from "./layoutTemplate";
import { PACKAGE_BY_ID, PACKAGES } from "./packages";
import { CABINET_STANDARDS } from "./roomShell";
import type { CabinetModule, RunSegment } from "./roomShell";

/**
 * Two machines set into the same run have a board between them. D11, round 53.
 *
 * With no island the microwave drawer and the wine cabinet go onto the
 * refrigerator's leg as two rough openings, and until this round they butt:
 * the segments tile exactly, so the gap between them was 0.0000" and there was
 * no carcass side at all. A rough opening is a hole in the run, not a cabinet
 * with sides of its own, so two of them side by side is two machines with
 * nothing between.
 *
 * This is a structural rule, not a thermal one, and it is not the column
 * group's kit: see D11 rule 15 and D22's note on the two figures.
 */

const noIsland = (overrides: Partial<LayoutParams> = {}): LayoutParams => ({
  ...DEFAULT_PARAMS,
  hasIsland: false,
  // Long enough that the pair is actually placed: the leg's bill is 159-3/4"
  // with the divider, and 162" is the next step the wall slider stops on.
  leftWallIn: 162,
  ...overrides,
});

const built = (id: string, params: LayoutParams) => {
  const result = generateLayout(params, PACKAGE_BY_ID[id]);
  expect(result.ok, `${id}: ${JSON.stringify("reasons" in result ? result.reasons : "")}`).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.layout;
};

const segments = (layout: ReturnType<typeof built>) =>
  layout.runs.flatMap((run) => run.segments);

const openingsOf = (list: RunSegment[]) =>
  list.filter((segment) => segment.modules.some((module) => module.kind === "opening"));

describe.each(["package-a", "package-c"])("the pair on a run, %s", (id) => {
  it("stands a board between the two machines, not nothing", () => {
    const list = segments(built(id, noIsland()));
    const microwave = list.find((s) => s.slot === "slot-microwave")!;
    const wine = list.find((s) => s.slot === "slot-wine")!;
    expect(microwave, "microwave placed").toBeTruthy();
    expect(wine, "wine placed").toBeTruthy();
    const gapIn = (Math.max(microwave.from, wine.from) - Math.min(microwave.to, wine.to)) * 12;
    expect(gapIn).toBeCloseTo(0.75, 9);
  });

  it("fills that gap with one 3/4 inch panel and nothing else", () => {
    const list = segments(built(id, noIsland()));
    const microwave = list.find((s) => s.slot === "slot-microwave")!;
    const wine = list.find((s) => s.slot === "slot-wine")!;
    const from = Math.min(microwave.to, wine.to);
    const to = Math.max(microwave.from, wine.from);
    const between = list.filter((s) => s.from >= from - 1e-9 && s.to <= to + 1e-9);
    expect(between).toHaveLength(1);
    const modules = between[0].modules;
    expect(modules).toHaveLength(1);
    expect(modules[0].widthIn).toBe(0.75);
  });

  it("orders it as a panel, which is a board somebody cuts", () => {
    const list = segments(built(id, noIsland()));
    const microwave = list.find((s) => s.slot === "slot-microwave")!;
    const wine = list.find((s) => s.slot === "slot-wine")!;
    const from = Math.min(microwave.to, wine.to);
    const to = Math.max(microwave.from, wine.from);
    const module = list.find((s) => s.from >= from - 1e-9 && s.to <= to + 1e-9)!.modules[0];
    expect(module.kind).toBe("panel");
  });

  it("is not the column kit: a different part, and a visible one", () => {
    const list = segments(built(id, noIsland()));
    const microwave = list.find((s) => s.slot === "slot-microwave")!;
    const wine = list.find((s) => s.slot === "slot-wine")!;
    const from = Math.min(microwave.to, wine.to);
    const to = Math.max(microwave.from, wine.from);
    const module = list.find((s) => s.from >= from - 1e-9 && s.to <= to + 1e-9)!.modules[0];
    expect(module.kind).not.toBe("spacer");
    expect(module.code).not.toContain("COMBIKIT");
    expect(module.widthIn).not.toBe(0.625);
  });

  it("is a base carcass side, so the counter lands on it", () => {
    const list = segments(built(id, noIsland()));
    const microwave = list.find((s) => s.slot === "slot-microwave")!;
    const wine = list.find((s) => s.slot === "slot-wine")!;
    const from = Math.min(microwave.to, wine.to);
    const to = Math.max(microwave.from, wine.from);
    const module = list.find((s) => s.from >= from - 1e-9 && s.to <= to + 1e-9)!.modules[0];
    // Not the 96" a panel defaults to, which would be a board standing a foot
    // and a half out of the countertop.
    expect(module.heightIn).toBe(CABINET_STANDARDS.base.boxHeightIn);
  });

  it("puts the board on the leg's bill, so the wall has to pay for it", () => {
    const params = noIsland();
    const leg = params.fridgeEnd === "left" ? "left" : "back";
    const requirement = wallRequirement(params, leg, PACKAGE_BY_ID[id]);
    // 159" before this round: corner 42 + landing 12 + 24 + 24 + landing 15 + tall 42.
    expect(requirement.minimumIn).toBeCloseTo(159.75, 9);
  });
});

/**
 * Package D has a microwave drawer on its island and its wine is a column in
 * the tall bank, so with no island exactly one machine moves onto the leg.
 * A lopsided case on purpose: a rule written as "put a board between them"
 * rather than "between each pair of them" passes every test above and fails
 * here. (Round 50's lesson, D22.)
 */
describe("one machine alone takes no divider", () => {
  it("package D moves only the microwave drawer, and it stands on its own", () => {
    const layout = built("package-d", noIsland({ leftWallIn: 216, backWallIn: 240 }));
    const list = segments(layout);
    // Rough openings only: D's wine is a column in the tall bank, which is a
    // segment carrying `slot-wine` and is not one of the two that move.
    const spare = openingsOf(list).filter(
      (s) => s.slot === "slot-microwave" || s.slot === "slot-wine",
    );
    expect(spare.map((s) => s.slot)).toEqual(["slot-microwave"]);
    // No divider is ordered, because there is no pair to divide. Asked of the
    // part itself: D's coffee cabinet has its own 3/4" side panel and it does
    // stand hard against this microwave, quite correctly — a first draft of
    // this test asserted "no 3/4" panel touches it" and failed on that, which
    // was the test being wrong about the room rather than the room being wrong.
    expect(list.map((s) => s.id).filter((id) => id.startsWith("spare-divider"))).toEqual([]);
    const boards = list.flatMap((s) => s.modules).filter((m: CabinetModule) => m.kind === "panel");
    expect(boards.every((m) => m.heightIn !== CABINET_STANDARDS.base.boxHeightIn)).toBe(true);
  });
});

/**
 * The scope, stated so it cannot drift. The rule is about two rough openings
 * side by side; everywhere else on a run a machine's neighbour is a cabinet
 * with a side of its own. If that ever stops being true somewhere else, this
 * fails and somebody decides whether that place wants a board too.
 */
describe("nowhere else on a run do two rough openings touch", () => {
  it.each(PACKAGES.map((pkg) => pkg.id))("%s, island on and off", (id) => {
    for (const params of [
      { ...DEFAULT_PARAMS },
      noIsland(),
      noIsland({ fridgeEnd: "back" as const, sinkLeg: "left" as const, backWallIn: 216 }),
    ]) {
      const result = generateLayout(params, PACKAGE_BY_ID[id]);
      if (!result.ok) continue;
      for (const run of result.layout.runs) {
        const holes = openingsOf(run.segments);
        for (const a of holes) {
          for (const b of holes) {
            if (a === b) continue;
            expect(
              Math.abs(a.to - b.from) > 1e-9,
              `${id}: ${a.id} and ${b.id} touch with nothing between`,
            ).toBe(true);
          }
        }
      }
    }
  });
});
