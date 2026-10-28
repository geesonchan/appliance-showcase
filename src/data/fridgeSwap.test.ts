import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { candidatesFor } from "./candidates";
import { APPLIANCE_BY_ID, suitsPackageSlot } from "./catalogue";
import { fitCheck } from "./fit";
import { fridgeMount, slotsAsBuilt } from "./fridgeMount";
import { setActivePackage, setFridgeModel, setLayoutParams } from "./layoutState";
import type { LayoutParams } from "./layoutTemplate";
import { BUILDABLE_PACKAGES, PACKAGE_BY_ID, slotsOf } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance, Package } from "../types";

/**
 * Round 89, Leo: what stands round a refrigerator is the chosen model's to say,
 * not the package's. From Leo using package C — its counter-depth T36FT820NS
 * changed on the model card to the built-in T36BT120NS, and the cabinets round
 * it kept their height: the 84" machine ran up behind the cabinet over C's 72"
 * opening. The same class as the range (round 83) and the hood (round 87).
 *
 * Every package, every refrigerator its opening takes, picked the way the
 * model card picks it (`setFridgeModel`), against figures written out here
 * rather than read back from the code: the run's parts for it, how high the
 * cabinet over it starts, that the machine stands over its own opening, and
 * that nothing else along the run moved. And Leo's two rules for this round:
 * a counter-depth machine is not allowed in a bank of columns (B, D, E), and a
 * swap keeps the package's segment — against a return wall a counter-depth
 * machine keeps its 3-1/2" and the half inch comes out of the segment; a
 * built-in gets no more room for its doors than its own enclosure.
 *
 * The fridge-front round (Leo, 2026-10-24 and 2026-10-27) changed the second
 * rule: a built-in stands between a 3/4" side panel and its end, and a
 * counter-depth machine swapped into the shorter segment gets what rule 11
 * asks, the run moving along for it and the wall growing where it must
 * (`fridgeFront.test.ts`).
 */
afterAll(() => resetRoom());

const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000;
const short = (id: string) => id.replace(/^[a-z]+-/, "");

/** What the room built round the refrigerator, read off the runs and the boxes. */
function surround() {
  for (const run of RUNS) {
    const segment = run.segments.find((candidate) => candidate.slot === "slot-fridge");
    if (!segment) continue;
    const parts = segment.modules.map((module) => module.code).join(" ");
    const over = CABINETS.find(
      (box) => box.slot === "slot-fridge" && (box.id.endsWith("-over") || box.id.endsWith("-bridge")),
    );
    const axis = run.axis === "x" ? 0 : 2;
    const machine = SLOT_BY_ID["slot-fridge"].position[axis];
    return {
      parts,
      segmentIn: inches(segment.to - segment.from),
      // The cabinet over the machine: a bridge from the head of a built-in's
      // opening, or rule 11's cabinet an inch above a counter-depth machine.
      overFromIn: over ? inches(over.position[1] - over.size[1] / 2) : null,
      // Both span the machine's own opening, so the machine stands over the
      // middle of it when it stands over the middle of this box.
      overItsOpening: !!over && Math.abs(over.position[axis] - machine) < 1e-6,
    };
  }
  throw new Error("no refrigerator on any run");
}

/** Every segment but the refrigerator's, where it starts and stops. */
const others = () =>
  RUNS.flatMap((run) =>
    run.segments.filter((segment) => segment.slot !== "slot-fridge").map((s) => `${run.id} ${s.id} ${inches(s.from)}-${inches(s.to)}`),
  );

function swapTo(code: string, fridgeId: string, params: Partial<LayoutParams> = {}) {
  resetRoom();
  if (!setActivePackage(`package-${code.toLowerCase()}`).ok) throw new Error(`${code}: room refused`);
  if (Object.keys(params).length && !setLayoutParams({ ...REQUESTED_PARAMS, ...params }).ok) {
    throw new Error(`${code}: ${JSON.stringify(params)} refused`);
  }
  const walls = `${REQUESTED_PARAMS.backWallIn} x ${REQUESTED_PARAMS.leftWallIn}`;
  const before = others();
  // Read off the room, not the return value, so that run on round 88's code
  // (where this function did not exist) each case is red for what it says.
  const result = (setFridgeModel as unknown as ((a: Appliance) => { ok: boolean }) | undefined)?.(APPLIANCE_BY_ID[fridgeId]);
  return {
    ok: result?.ok !== false,
    ...surround(),
    nothingElseMoved: JSON.stringify(others()) === JSON.stringify(before),
    wallsKept: `${REQUESTED_PARAMS.backWallIn} x ${REQUESTED_PARAMS.leftWallIn}` === walls,
  };
}

const row = (r: ReturnType<typeof swapTo>) =>
  `${r.ok ? "" : "REFUSED "}${r.parts} (${r.segmentIn}) over from ${r.overFromIn}${r.overItsOpening ? "" : " OFF ITS OPENING"}${r.nothingElseMoved ? "" : " MOVED"}${r.wallsKept ? "" : " WALL GREW"}`;

describe("what stands round a refrigerator follows the model chosen (round 89)", () => {
  it("is an enclosure or rule 11's parts, built to the machine's height, for every refrigerator every opening takes", () => {
    const seen: Record<string, string> = {};
    for (const entry of BUILDABLE_PACKAGES) {
      resetRoom();
      setActivePackage(entry.id);
      const fitting = candidatesFor("slot-fridge", entry).filter(({ fit }) => fit.fits);
      for (const { appliance } of fitting) seen[`${entry.code} ${short(appliance.id)}`] = row(swapTo(entry.code, appliance.id));
    }
    // Round 98b: the 24" column T24IR905SP joined the catalogue (the third
    // import of round 98) and is offered in every opening it is narrow enough
    // for, as any model is (D20, round 46 — Leo accepted it in round 98b): in
    // A's, B's and C's enclosures and in D's and E's 30" column openings. In
    // each it stands as the 30" column beside it does; what goes in the rest
    // of the opening is the opening's, not the model's. Five rows, nothing
    // else changed.
    expect(seen).toEqual({
      // A's segment since the fridge-front round (Leo, 2026-10-27, 1): a
      // plain 3/4" side panel on the counter's side, the machine's own 36",
      // and a 3/4" panel against the cabinetry past it — 37-1/2", where it was
      // a 42" enclosure with 3" panels. A built-in or a column stands in it,
      // its bridge from the head of the 84" opening. The counter-depth machine
      // still gets rule 11's 3" panels and the cabinet an inch above its 72":
      // its segment is the longer of A's and what rule 11 asks (Leo,
      // 2026-10-24, 5), so the run along it moves and the wall here does not.
      "A t36bt120ns": "PNL0.75 T3696 PNL0.75 (37.5) over from 84",
      "A t36it100np": "PNL0.75 T3696 PNL0.75 (37.5) over from 84",
      "A t30ir905sp": "PNL0.75 T3696 PNL0.75 (37.5) over from 84",
      "A t24ir905sp": "PNL0.75 T3696 PNL0.75 (37.5) over from 84",
      "A t36ft820ns": "PNL3 RO36 PNL3 (42) over from 73 MOVED",
      // B's refrigerator stands in a bank with its wine column: built-ins and
      // the column only; the counter-depth machine is refused (Leo).
      "B t36bt120ns": "T3696 (36) over from 84",
      "B t36it100np": "T3696 (36) over from 84",
      "B t30ir905sp": "T3696 (36) over from 84",
      "B t24ir905sp": "T3696 (36) over from 84",
      // C's own 42" of rule 11; a built-in or a column stands in it as in A,
      // its bridge from 84" — Leo's case — and the 4-1/2" C's segment has
      // over A's goes in a board outside the side panel, on the counter's
      // side (Leo, 2026-10-24, 4, and 2026-10-27, 4).
      "C t36ft820ns": "PNL3 RO36 PNL3 (42) over from 73",
      "C t36bt120ns": "PNL4.5 PNL0.75 T3696 PNL0.75 (42) over from 84",
      "C t36it100np": "PNL4.5 PNL0.75 T3696 PNL0.75 (42) over from 84",
      "C t30ir905sp": "PNL4.5 PNL0.75 T3696 PNL0.75 (42) over from 84",
      "C t24ir905sp": "PNL4.5 PNL0.75 T3696 PNL0.75 (42) over from 84",
      // D's and E's 30" column in their banks: the columns alone fit.
      "D t30ir905sp": "T3096 (30) over from 84",
      "D t24ir905sp": "T3096 (30) over from 84",
      "E t30ir905sp": "T3096 (30) over from 84",
      "E t24ir905sp": "T3096 (30) over from 84",
    });
  });

  it("builds package C's own refrigerator opening into an enclosure for the built-in T36BT120NS, Leo's case", () => {
    const r = swapTo("C", "thermador-t36bt120ns");
    // Since the fridge-front round: C's 42", a 3/4" side panel each side of
    // the machine and the rest outside the counter's one (Leo, 2026-10-24, 4).
    expect({ parts: r.parts, overFromIn: r.overFromIn }).toEqual({ parts: "PNL4.5 PNL0.75 T3696 PNL0.75", overFromIn: 84 });
  });

  it("gives the counter-depth T36FT820NS rule 11's parts in package A, and a cabinet an inch over its own top", () => {
    const r = swapTo("A", "thermador-t36ft820ns");
    expect({ parts: r.parts, overFromIn: r.overFromIn }).toEqual({ parts: "PNL3 RO36 PNL3", overFromIn: 73 });
  });

  it("gives the counter-depth machine against a return wall in A rule 11's whole 3 + 36 + 3-1/2 inches, the run moving along for it", () => {
    // Until the fridge-front round the swap kept A's 42" and took the half
    // inch off the corner side's panel. Leo, 2026-10-24, 5: the segment grows
    // to what rule 11 asks; here the room has the wall, so only the run moves.
    const r = swapTo("A", "thermador-t36ft820ns", { fridgeEndAbuts: "wall" });
    expect({ parts: r.parts, segmentIn: r.segmentIn, overItsOpening: r.overItsOpening, moved: !r.nothingElseMoved, wallsKept: r.wallsKept }).toEqual({
      parts: "PNL3 RO36 BF3.5",
      segmentIn: 42.5,
      overItsOpening: true,
      moved: true,
      wallsKept: true,
    });
  });

  it("gives a built-in in C's segment against a return wall its side panel and 3-1/2 inches, and the rest in a board on the counter's side", () => {
    // Until the fridge-front round: a 42" enclosure and a half-inch scribe at
    // the wall. Now the wall end is A's against a wall, 3-1/2" of filler, and
    // C's segment keeps its 42-1/2" (Leo, 2026-10-24, 4, and 2026-10-27, 4).
    const r = swapTo("C", "thermador-t36bt120ns", { fridgeEndAbuts: "wall" });
    expect({ parts: r.parts, segmentIn: r.segmentIn, overItsOpening: r.overItsOpening, moved: !r.nothingElseMoved || !r.wallsKept }).toEqual({
      parts: "PNL2.25 PNL0.75 T3696 BF3.5",
      segmentIn: 42.5,
      overItsOpening: true,
      moved: false,
    });
  });

  it("stands C's own refrigerator over its own opening against a return wall, not the middle of the segment", () => {
    // 3" panel, 36" opening, 3-1/2" filler: the middle of the segment is 1/4"
    // past the middle of the opening. Until round 89 the machine stood there.
    expect(swapTo("C", "thermador-t36ft820ns", { fridgeEndAbuts: "wall" }).overItsOpening).toBe(true);
  });

  it("generates the room again only when the refrigerator is built in differently or to another height", () => {
    const rebuilt = (code: string, id: string) => {
      resetRoom();
      setActivePackage(`package-${code.toLowerCase()}`);
      return (setFridgeModel(APPLIANCE_BY_ID[id]) as { rebuilt?: boolean } | undefined)?.rebuilt ?? null;
    };
    expect({
      columnForBuiltIn: rebuilt("A", "thermador-t30ir905sp"),
      counterDepthForBuiltIn: rebuilt("A", "thermador-t36ft820ns"),
      builtInForCounterDepth: rebuilt("C", "thermador-t36bt120ns"),
    }).toEqual({ columnForBuiltIn: false, counterDepthForBuiltIn: true, builtInForCounterDepth: true });
  });

  it("gives every package's own refrigerator its slot exactly as the package writes it", () => {
    const changed = BUILDABLE_PACKAGES.filter((entry) => {
      resetRoom();
      return JSON.stringify(slotsAsBuilt(entry)["slot-fridge"]) !== JSON.stringify(slotsOf(entry)["slot-fridge"]);
    }).map((entry) => entry.code);
    expect({ packages: BUILDABLE_PACKAGES.length, changed }).toEqual({ packages: 5, changed: [] });
  });
});

describe("a counter-depth refrigerator in a bank of columns (round 89)", () => {
  it("is refused in B's refrigerator opening, with the reason", () => {
    resetRoom();
    setActivePackage("package-b");
    const fit = fitCheck(SLOT_BY_ID["slot-fridge"], APPLIANCE_BY_ID["thermador-t36ft820ns"]);
    expect({ fits: fit.fits, widthFits: fit.widthFits, notInColumnBank: fit.notInColumnBank }).toEqual({
      fits: false,
      widthFits: true,
      notInColumnBank: true,
    });
  });

  it("is not refused in A's or C's, which stand alone", () => {
    const fits = ["package-a", "package-c"].map((id) => {
      resetRoom();
      setActivePackage(id);
      return fitCheck(SLOT_BY_ID["slot-fridge"], APPLIANCE_BY_ID["thermador-t36ft820ns"]).fits;
    });
    expect(fits).toEqual([true, true]);
  });

  it("does not refuse a built-in or a column in a bank", () => {
    resetRoom();
    setActivePackage("package-b");
    const refused = ["thermador-t36bt120ns", "thermador-t36it100np", "thermador-t30ir905sp"].filter(
      (id) => fitCheck(SLOT_BY_ID["slot-fridge"], APPLIANCE_BY_ID[id]).notInColumnBank,
    );
    expect(refused).toEqual([]);
  });

  it("is asked by a package switch too, on the run's own answer to which openings are in a bank", () => {
    // A slot that says it installs counter-depth, so install type lets the
    // machine through and only the bank can stop it: in B's bank, and not in
    // A, where the refrigerator stands alone.
    const asCounterDepth = (entry: Package): Package => ({
      ...entry,
      slots: entry.slots.map((slot) => (slot.slotId === "slot-fridge" ? { ...slot, installType: "counter-depth" } : slot)),
    });
    const fridge = APPLIANCE_BY_ID["thermador-t36ft820ns"];
    const carried = (id: string) => {
      const entry = asCounterDepth(PACKAGE_BY_ID[id]);
      return suitsPackageSlot(fridge, slotsOf(entry)["slot-fridge"], entry);
    };
    expect({ intoB: carried("package-b"), intoA: carried("package-a") }).toEqual({ intoB: false, intoA: true });
  });
});

describe("how a refrigerator is built in (round 89)", () => {
  it("is read from the model's install type, and refused loudly when it says neither", () => {
    const fridge = APPLIANCE_BY_ID["thermador-t36ft820ns"];
    expect({
      builtIn: fridgeMount(APPLIANCE_BY_ID["thermador-t36bt120ns"]),
      column: fridgeMount(APPLIANCE_BY_ID["thermador-t30ir905sp"]),
      counterDepth: fridgeMount(fridge),
      // The importer's default for a row nothing matched (D4) is not taken at its word.
      freestandingThrows: (() => {
        try {
          fridgeMount({ ...fridge, installType: ["freestanding"] });
          return false;
        } catch {
          return true;
        }
      })(),
    }).toEqual({ builtIn: "built-in", column: "built-in", counterDepth: "freestanding", freestandingThrows: true });
  });
});
