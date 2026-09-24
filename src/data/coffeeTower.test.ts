import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { setActivePackage } from "./layoutState";
import { underCoffee } from "./layoutTemplate";
import { PACKAGE_BY_ID } from "./packages";
import { RUNS } from "./room";
import { resolveRoughIn, roughInWords } from "./roughIn";
import { SLOT_BY_ID } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import { translate } from "../i18n";
import type { SlotId } from "../types";

/**
 * Round 73: package E's wine cooler under its coffee machine, and what the
 * coffee machine's own manual asks of the tower round it. One assertion each;
 * every answer is stated from the room — which segment is which, what stands
 * where — not read back from the code that placed it.
 */
afterAll(() => resetRoom());

function open(id: string) {
  resetRoom();
  const result = setActivePackage(id);
  if (!result.ok) throw new Error(`${id} will not build: ${JSON.stringify(result.reasons)}`);
}

const inches = (feet: number) => Math.round(feet * 12 * 1000) / 1000;
const segmentOfSlot = (slot: SlotId) =>
  RUNS.flatMap((run) => run.segments).find((s) => s.modules.some((m) => m.slot === slot || m.lowerSlot === slot));

describe("E's wine cooler", () => {
  it("stands in the bottom of the coffee cabinet, not on the island or a leg", () => {
    open("package-e");
    expect(segmentOfSlot("slot-wine-2")?.slot).toBe("slot-coffee");
  });

  it("stands on the floor", () => {
    open("package-e");
    expect(inches(SLOT_BY_ID["slot-wine-2"].position[1])).toBe(0);
  });

  it("has no cabinet toe kick running in front of its base, where its vent is", () => {
    open("package-e");
    const tower = segmentOfSlot("slot-wine-2")!;
    const run = RUNS.find((r) => r.segments.includes(tower))!;
    const lo = Math.min(tower.from, tower.to);
    const hi = Math.max(tower.from, tower.to);
    const axis = run.axis === "x" ? 0 : 2;
    const across = CABINETS.filter((box) => box.kind === "toe" && box.id.startsWith(`${run.id}-toe`)).filter((box) => {
      const from = box.position[axis] - box.size[axis] / 2;
      const to = box.position[axis] + box.size[axis] / 2;
      return from < hi - 1e-6 && to > lo + 1e-6;
    });
    expect(across.map((box) => box.id)).toEqual([]);
  });

  it("is named on the slider as what stands under the coffee machine", () => {
    expect(
      translate("en", `panel.layout.coffeeSill.caption.${underCoffee(PACKAGE_BY_ID["package-e"].slots)}`, { sillIn: 42 }),
    ).toBe('Machine starts 42" off the floor; wine cooler under it');
  });
});

describe("what the slider says is under the coffee machine", () => {
  it("says dishwasher in D", () => {
    expect(underCoffee(PACKAGE_BY_ID["package-d"].slots)).toBe("dishwasher");
  });

  it("says cabinet where the coffee cabinet stands over nothing", () => {
    const slots = PACKAGE_BY_ID["package-e"].slots.map((slot) =>
      slot.slotId === "slot-coffee" ? { ...slot, standsOver: null } : slot,
    );
    expect(underCoffee(slots)).toBe("cabinet");
  });
});

/**
 * On the back leg, the cabinet beside E's coffee tower that has doors is the
 * 24" base between it and the sink base (Leo, round 73). Everything the two
 * machines plug into is there: the coffee machine's water, its optional drain
 * and its transformer's receptacle, and the wine cooler's socket.
 */
describe("E's coffee cabinet, its connections in the base beside it", () => {
  const b24 = () => {
    const back = RUNS.find((run) => run.id === "back")!;
    const at = back.segments.findIndex((s) => s.slot === "slot-coffee");
    // Past the tower's finished board, the first segment that is a base cabinet.
    return back.segments.slice(at + 1).find((s) => s.modules.some((m) => m.kind === "base"))!;
  };
  const hosts = () => {
    const selection = defaultSelectionOf("package-e");
    return (["slot-coffee", "slot-wine-2"] as const).flatMap((slot) =>
      resolveRoughIn(slot, selection[slot]).map((r) => `${slot} ${r.point.type} ${r.host.id}`),
    );
  };

  it("is the 24-inch base beside the tower, as E opens", () => {
    open("package-e");
    expect([b24().id, inches(Math.abs(b24().to - b24().from))]).toEqual(["back-sink-landing-0", 24]);
  });

  it("holds all four points, as E opens", () => {
    open("package-e");
    const id = b24().id;
    expect(hosts()).toEqual([
      `slot-coffee water ${id}`,
      `slot-coffee drain ${id}`,
      `slot-coffee power ${id}`,
      `slot-wine-2 power ${id}`,
    ]);
  });

  it("calls the drain optional, in its own words", () => {
    open("package-e");
    const selection = defaultSelectionOf("package-e");
    const drain = resolveRoughIn("slot-coffee", selection["slot-coffee"]).find((r) => r.point.type === "drain")!;
    expect(translate("en", roughInWords(drain).typeKey)).toBe("drain (optional)");
  });
});

/**
 * The same model in A's island: its socket goes in the island's own cabinet
 * beside it, not behind it and not dropped. A's island is 6" at its ends,
 * which is a filler, and 18" beside the wine cabinet, which is a cabinet.
 */
describe("A's island wine cabinet", () => {
  it("has its socket in the island cabinet beside it", () => {
    open("package-a");
    const selection = defaultSelectionOf("package-a");
    const [socket] = resolveRoughIn("slot-wine", selection["slot-wine"]);
    expect([socket?.noCabinet, socket?.host.id.includes("-island-")]).toEqual([false, true]);
  });
});
