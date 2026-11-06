import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID, stainlessRowOf } from "../data/catalogue";
import { CABINETS } from "../data/cabinets";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PACKAGE } from "../data/packages";
import { ISLAND, LAYOUT_PARAMS, RUNS, SLOT_PLACEMENT } from "../data/room";
import { resetRoom } from "../data/testRoom";
import { openSharedLink } from "./openLink";
import ROUND_98B1 from "./shareLink.round98b1.json";
import { useAppStore } from "./useAppStore";

/**
 * A v=2 link opens as it did when round 98b-1 wrote it. Round 98b-2 (Leo: "旧
 * 的 v=2 链接打开要和现在完全一样，怎么证明"): ten links written by 98b-1's own
 * code — every package as it opens in the L, and on one wall — with the room
 * that code opened each to (`shareLink.round98b1.json`, with how). 98b-2 keeps
 * the link's format: a link is the room on screen (D23).
 */

const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();

function freshPage() {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
}

/**
 * The selection as 98b-1 named it. A built-in column is two rows since
 * 2026-11-02 (Leo): its -SS row is what its own number was then, the
 * stainless one, and so is named by that number; its own number, panel-ready
 * now, by a name 98b-1 never held, so a link that opened one would not hash
 * as 98b-1's room.
 */
const asThen = (selection: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(selection).map(([slot, id]) => {
      const row = APPLIANCE_BY_ID[id];
      const own = row && APPLIANCE_BY_ID[id.replace(/-ss$/, "")];
      if (own && own !== row && stainlessRowOf(own) === row) return [slot, own.id];
      if (row && stainlessRowOf(row)) return [slot, `${id} panel-ready`];
      return [slot, id];
    }),
  );

/** The room as the fixture hashed it. */
const held = () =>
  createHash("sha256")
    .update(
      JSON.stringify({ params: LAYOUT_PARAMS, runs: RUNS, slots: SLOT_PLACEMENT, island: ISLAND, cabinets: CABINETS, selection: asThen(store().selection) }),
    )
    .digest("hex");

const LINKS = Object.entries(ROUND_98B1.links);

/**
 * The one that cannot open as it did: E on one wall. Round 98b-2 stands its
 * coffee tower clear of the wall for its door (Leo's option 戊), so 98b-1's
 * E is not a room this code builds; its link's 261-5/8" back wall is still a
 * wall E builds at, with the 18" beside its oven tower down to the 6" that
 * clearance stops at (D11 rule 12) — and the link opens it there, saying
 * nothing, as a link opens any wall that builds (D23).
 */
const CHANGED_BY_98B2 = "E one-wall";

/**
 * Package A's two, which open a different room since the fridge-front round,
 * because Leo changed the room (2026-10-24 and 2026-10-27): A's refrigerator
 * stands between a 3/4" side panel and its end, where it stood in a 42"
 * enclosure. The walls, the island and the models are as the links say —
 * 168" x 144", and 237-3/4" on one wall, opened as it is with nothing left
 * out (Leo, 2026-10-27, 5) — and the runs, the machines' places and the
 * cabinet boxes are the new ones. The rooms this code opens them to, hashed
 * as `held` hashes them on this round's code.
 */
const CHANGED_BY_FRIDGE_FRONT: Record<string, string> = {
  "A L": "49e226c13c4d42a2a459aab5551f255441944afdefac21b4796bc15784ae0018",
  "A one-wall": "d932800111d21b82e0dd46cb18b7ab18ad74134ff8c82d91d371c456339c06cc",
};

/**
 * B's, D's and E's, but for E on one wall, which open a different room since
 * round 101, because Leo changed the room (2026-11-04, A-3, A-4, A-16; item
 * 5, 2026-11-05): the columns stand case against case, no 5/8" kit between
 * two, and B's two boards are 3/4" where they were 3". The walls and the
 * models are the links' own; the columns are narrower and what they gave up
 * is the refrigerator's landing, or the corner's, on the same leg:
 * - B L (201-5/8" x 144"): the bank 5-1/8" narrower (two boards 3" to 3/4",
 *   the kit out). The refrigerator's landing B15 to DB18 + BF2-1/8, 15" to
 *   20-1/8". (B opens at the wall it needs, 196-1/2" since this round; a link
 *   opens at its own, Leo's answer 1.)
 * - B one-wall (244-1/8"): the bank 2-7/8" narrower (its inner board, the
 *   kit; at the wall its 3-1/2" filler, as it was). The landing B15 to B15 +
 *   BF2-7/8.
 * - D L (224-1/4" x 178-3/4", D's own room): 1-1/4" (two kits). The
 *   landing DB18 + BF1/2 to DB18 + BF1-3/4, as the plan said (A-7).
 * - D one-wall (249-1/4"): 1-1/4". The landing B15 to B15 + BF1-1/4.
 * - E L (180" x 168", E's own room): 5/8" (one kit). The corner's landing B24
 *   + BF7/8 to B24 + BF1-1/2.
 * E on one wall is the room 98b-2 changed already (`CHANGED_BY_98B2`, below
 * its hash is only said to differ); there its 5/8" goes to the refrigerator's
 * landing, B15 to B15 + BF5/8, its coffee tower's 12" and the 6" beside its
 * oven tower as they were (the last test here). Hashed as `held` hashes, on
 * this round's code.
 */
const CHANGED_BY_ROUND_101: Record<string, string> = {
  "B L": "18e3c5bfa337cbefd2a6fe4ac820cdd83cc1220e43248bc00f0c84e07c250901",
  "B one-wall": "663d29e74adfb41b12cb117d8bc25809ad8479685018d203f33c999fbb035cee",
  "D L": "4decddb5bb0d970015f6ef6d724755b07af026de0b3e4ccf1d5cbf4f9b1a2c94",
  "D one-wall": "f70aa23e46fb0c1bedb2a1bd410aecc9ca40fc492581011db81ad9c1413b78ac",
  "E L": "dd6870f58e495ecf8e0e3904a9fc971ae1c58635fa4a725740b668b945d76bdc",
};

/**
 * Six that open a different room again since the end-of-run round (Leo,
 * 2026-11-04, A-9 to A-13, and 2026-11-05, his site practice 甲 for a tall
 * unit at a wall). The walls and the models are the links' own:
 * - the open end a 3/4" end panel, BEP, where it was a 3" panel, the 2-1/4"
 *   counter on the same leg: A one-wall (237-3/4") the refrigerator's landing
 *   B15 + BF1-3/4 to DB18 + BF1; B L (201-5/8" x 144") the corner's landing
 *   B27 to B27 + BF2-1/4; B one-wall (244-1/8") B15 + BF2-7/8 to DB18 +
 *   BF2-1/8; C one-wall (232-1/4") B15 to B15 + BF2-1/4; D one-wall
 *   (249-1/4") B15 + BF1-1/4 to DB18 + BF1/2.
 * - D L (224-1/4" x 178-3/4", D's own room): the 3" between its steam oven
 *   tower and the back wall one filler floor to top, no stone and nothing
 *   over it; nothing else.
 * E on one wall changes too (its landing B15 + BF5/8 to B15 + BF2-7/8), and
 * is already the room 98b-2 changed (`CHANGED_BY_98B2`). Hashed as `held`
 * hashes, on this round's code; looked up before the earlier rounds' maps.
 */
const CHANGED_BY_END_ROUND: Record<string, string> = {
  "A one-wall": "eb83f4a2cb31cb2feffa2b1ea1c67d6968c1c114d1a4dfe7b336af61752a75f1",
  "B L": "876f0236fb520b4b85793626d475677d10fff485d69d8d6f57519f59ee1bb1ef",
  "B one-wall": "b4ef360444a26d059cb707ddfa8e4de470d3017f59c9272077c9d0f5d518029a",
  "C one-wall": "44ed912def19cd93f7bb9b6f757df45ff73cfc147ea09e0c0d8173b99d225a7d",
  "D L": "508d8457d3b43153bf82bca1f0df6317f6024b1ac984e40ea98aa59a519b0a21",
  "D one-wall": "a556c136e3410fc6e1fdd85531844fd55343bf6f7f2b6cdc59cba01be2b1e453",
};

describe("the ten v=2 links round 98b-1 wrote", () => {
  it("is ten: five packages, in the L and on one wall", () => {
    expect(LINKS.length).toBe(10);
  });

  describe.each(LINKS)("%s", (_name, fixture) => {
    it("opens the room 98b-1 opened, every run, machine, cabinet box and model — but E on one wall", () => {
      freshPage();
      openSharedLink(fixture.link);
      if (_name in CHANGED_BY_END_ROUND) expect(held()).toBe(CHANGED_BY_END_ROUND[_name]);
      else if (_name in CHANGED_BY_FRIDGE_FRONT) expect(held()).toBe(CHANGED_BY_FRIDGE_FRONT[_name]);
      else if (_name in CHANGED_BY_ROUND_101) expect(held()).toBe(CHANGED_BY_ROUND_101[_name]);
      else expect(held() === fixture.room).toBe(_name !== CHANGED_BY_98B2);
    });

    it("says nothing on opening", () => {
      freshPage();
      openSharedLink(fixture.link);
      expect(store().toast).toBeNull();
    });
  });

  it("opens E's one-wall link at its own back wall, its coffee tower clear of the wall and 6 inches beside its oven tower", () => {
    freshPage();
    openSharedLink(ROUND_98B1.links[CHANGED_BY_98B2].link);
    const width = (id: string) => RUNS[0].segments.filter((s) => s.id.startsWith(`back-${id}`)).reduce((a, s) => a + (s.to - s.from) * 12, 0);
    expect({ backWallIn: LAYOUT_PARAMS.backWallIn, coffeeDoorIn: width("coffee-door"), besideTowerIn: width("tower-clearance") }).toEqual({
      backWallIn: 261.625,
      coffeeDoorIn: 12,
      besideTowerIn: 6,
    });
  });
});
