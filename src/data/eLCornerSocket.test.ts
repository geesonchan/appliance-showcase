/**
 * Item 11 (Leo's order of 2026-11-12, 4 and 5; docs/plans/item11-plan-final.md, confirmed
 * 2026-11-13 with 「烤箱塔离转角：12″」 and 「咖啡机在左段那 16 间的插座：下面那一格」).
 *
 * E's L with the sink on the left leg and the refrigerator on the back leg: 32 rooms.
 *  - With the coffee tower on the back leg (16), the combination oven tower stood first on the
 *    back leg, hard against the corner the left leg's box holds (D11 rule 1). Now a 12" counter
 *    (rule 1's own figure) stands between them.
 *  - With the coffee tower on the left leg (16), the oven tower stands between the dishwasher and
 *    the coffee tower, a machine each side, and its power point — wanted in the cabinet beside
 *    the tower — dropped out of the list with nothing said. Now it goes in the drawer under the
 *    opening, as PODS302B's does, and the list says why.
 *
 * Every room of every shape the page builds is asked both things, not only these 32: nothing tall
 * hard against a corner at either end of a run, and every connection that wants a neighbour's
 * cabinet either in one or placed where its model's `whenNoCabinet` says. Both are judged from
 * the room as built, not by `checkLayout`, so they say the same thing of the old code and the new.
 */
import { afterAll, describe, expect, it } from "vitest";
import * as testRoom from "./testRoom";
import * as packages from "./packages";
import * as layoutState from "./layoutState";
import * as roomState from "./room";
import * as candidates from "./candidates";
import * as catalogue from "./catalogue";
import * as layoutTemplate from "./layoutTemplate";
import { lRooms, oneWallRooms, uRooms } from "./roomSets";
import { listRoughIn } from "./roughInList";
import { roughInCalloutKey, roughInFor, roughInWords } from "./roughIn";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import roughInFile from "../../data/rough-in.json";
import type { Appliance, SlotId } from "../types";

afterAll(() => testRoom.resetRoom());

const m = { testRoom, packages, layoutState, room: roomState, candidates, catalogue, layoutTemplate };
const inches = (s: { from: number; to: number }) => Math.round((s.to - s.from) * 12 * 1000) / 1000;
const say = (lang: "en" | "zh", key: string, vars?: Record<string, string | number>) =>
  sayWith((k, v) => translate(lang, k, v), key, vars);

/** What is tall and hard against a corner in the room standing now, at either end of a run. */
function tallAgainstCorner(): string[] {
  const out: string[] = [];
  for (const run of roomState.RUNS) {
    const s = run.segments.filter((x) => inches(x) > 1); // a 3/4" board is no neighbour
    s.forEach((segment, i) => {
      if (segment.kind !== "tall") return;
      if (s[i - 1]?.kind === "corner" || s[i + 1]?.kind === "corner") out.push(`${run.id}: ${segment.id} beside the corner box`);
      if (i === 0 && run.ends[0] === "corner") out.push(`${run.id}: ${segment.id} first, against the corner at its low end`);
      if (i === s.length - 1 && run.ends[1] === "corner") out.push(`${run.id}: ${segment.id} last, against the corner at its high end`);
    });
  }
  return out;
}

const wantsCabinet = (location: string) => location.startsWith("adjacent-cabinet") || location === "beside-tower";

/** The connections that want a neighbour's cabinet and are not in the list, in the room standing now. */
function dropped(sel: Record<SlotId, Appliance>): string[] {
  const listed = listRoughIn(sel);
  const omitted = new Set(roomState.OMITTED_SLOTS);
  return packages.SLOT_ORDER.flatMap((slotId) => {
    if (omitted.has(slotId)) return [];
    const want = (roughInFor(sel[slotId])?.points ?? []).filter((p) => wantsCabinet(p.location)).length;
    const got = listed.filter((i) => i.slotId === slotId && wantsCabinet(i.resolved.point.location)).length;
    return got < want ? [`${slotId} ${sel[slotId]?.model}: ${got} of ${want}`] : [];
  });
}

const SHAPES = { L: () => lRooms(m), "one wall": () => oneWallRooms(m), U: () => uRooms(m) };

describe.each(Object.entries(SHAPES))("%s: every room the page builds", (_shape, rooms) => {
  it("stands nothing tall hard against a corner, at either end of a run (D11 rule 1)", () => {
    const found: string[] = [];
    for (const c of rooms()) {
      if (!c.build().ok) continue;
      for (const w of tallAgainstCorner()) found.push(`${c.label} — ${w}`);
    }
    expect(found, found.slice(0, 20).join("\n")).toEqual([]);
  });

  it("puts every connection that wants a neighbour's cabinet in one, or where its model says", () => {
    const found: string[] = [];
    for (const c of rooms()) {
      if (!c.build().ok) continue;
      for (const w of dropped(c.selection() as Record<SlotId, Appliance>)) found.push(`${c.label} — ${w}`);
    }
    expect(found, found.slice(0, 20).join("\n")).toEqual([]);
  });
});

/** E's L rooms with the sink on the left leg and the refrigerator on the back leg, by the coffee tower's leg. */
function theThirtyTwo() {
  const rooms: { label: string; coffeeLeg: string; sel: Record<SlotId, Appliance> }[] = [];
  for (const c of lRooms(m)) {
    if (c.pkg.code !== "E" || !c.build().ok) continue;
    const p = roomState.LAYOUT_PARAMS;
    if (p.sinkLeg !== "left" || p.fridgeEnd !== "back") continue;
    rooms.push({ label: c.label, coffeeLeg: p.coffeeLeg, sel: c.selection() as Record<SlotId, Appliance> });
  }
  return rooms;
}

describe("E's L, the sink on the left leg and the refrigerator on the back leg", () => {
  const rooms = theThirtyTwo();
  const byLeg = (leg: string) => rooms.filter((r) => r.coffeeLeg === leg);
  /** Stand one of them up again: the room set builds each by its label. */
  const stand = (label: string) => {
    const c = lRooms(m).find((x) => x.label === label)!;
    expect(c.build().ok).toBe(true);
  };

  it("is 32 rooms, 16 with the coffee tower on each leg", () => {
    expect(byLeg("back")).toHaveLength(16);
    expect(byLeg("left")).toHaveLength(16);
  });

  it.each(byLeg("back").map((r) => [r.label]))("coffee on the back leg: 12\" of counter, then the oven tower (%s)", (label) => {
    stand(label);
    const back = roomState.RUNS.find((r) => r.id === "back")!;
    const [first, second] = back.segments.filter((s) => inches(s) > 1);
    expect([first.kind, inches(first)]).toEqual(["counter", 12]);
    expect(second.slot).toBe("slot-microwave");
  });

  it.each(byLeg("back").map((r) => [r.label]))(
    "coffee on the back leg: the oven's socket in that counter, the words unchanged (%s)",
    (label) => {
      stand(label);
      const sel = rooms.find((r) => r.label === label)!.sel;
      const oven = listRoughIn(sel).filter((i) => i.slotId === "slot-microwave");
      expect(oven).toHaveLength(1);
      expect(oven[0].resolved.noCabinet).toBe(false);
      const words = roughInWords(oven[0].resolved);
      expect(say("zh", "rule.roughIn", words)).toBe("电源：高柜旁的地柜内（打开柜门可见），距右侧 3\"、靠顶部");
      expect(say("en", "rule.roughIn", words)).toBe(
        "power — in the base cabinet beside the tower — open its door to see it, 3\" from the right side, at the top",
      );
    },
  );

  it.each(byLeg("left").map((r) => [r.label]))(
    "coffee on the left leg: the oven's socket in the drawer under its opening, and the list says why (%s)",
    (label) => {
      stand(label);
      const sel = rooms.find((r) => r.label === label)!.sel;
      const oven = listRoughIn(sel).filter((i) => i.slotId === "slot-microwave");
      expect(oven).toHaveLength(1);
      expect(oven[0].resolved.noCabinet).toBe(true);
      const words = roughInWords(oven[0].resolved);
      expect(say("zh", "rule.roughIn", words)).toBe("电源：开口下方抽屉的后部，靠顶部");
      expect(say("en", "rule.roughIn", words)).toBe("power — at the back of the drawer under the opening, at the top");
      // The callout ends as PODS302B's does: the point itself has no provenance.
      expect(say("zh", roughInCalloutKey(oven[0].resolved.point), words)).toBe("电源：开口下方抽屉的后部，靠顶部。出处尚未审核。");
      expect(say("en", roughInCalloutKey(oven[0].resolved.point), words)).toBe(
        "power: at the back of the drawer under the opening, at the top. Not yet reviewed.",
      );
      const warnings = checklistFor(sel, null).findings.filter((f) => f.slot === "slot-microwave" && f.severity === "warning");
      const said = warnings.map((f) => [say("zh", f.messageKey!, f.params as never), say("en", f.messageKey!, f.params as never)]);
      expect(said).toContainEqual([
        "高柜两侧都没有橱柜，因此该接点设在开口下方的抽屉内。",
        "No cabinet on either side of the tower, so this connection goes in the drawer under the opening.",
      ]);
    },
  );
});

describe("MEM301WS's power point, in its data", () => {
  const point = (roughInFile as any).roughIn["thermador-mem301ws"].points[0];

  it("gives the conduit as the manual's drawing does, 50\" (1270 mm), and says where the spec sheet's 60\" is", () => {
    // Leo, 2026-11-13: 「数据里 MEM301WS 软管 60″ 改成 50″，写出处」.
    expect(point.note).toContain("within reach of the 50\" conduit");
    expect(point.note).not.toContain("within reach of the 60\"");
    expect(point.note).toContain("mem301ws-spec.pdf p. 1");
  });

  it("says where it goes with no cabinet beside the tower: the drawer under the opening, Leo's, with both documents quoted", () => {
    expect(point.whenNoCabinet).toMatchObject({ where: "drawer-below", x: "center", y: "top", z: "rear", conditionKey: null, provenance: "site" });
    expect(point.whenNoCabinet.basis).toContain("above, beneath, right or left of the unit within range of the power cable");
    expect(point.whenNoCabinet.basis).toContain("p. 25");
    expect(point.whenNoCabinet.basis).toContain("above, left or right of the unit within reach of the flexible conduit");
  });
});
