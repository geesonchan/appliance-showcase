import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
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

/** The room as the fixture hashed it. */
const held = () =>
  createHash("sha256")
    .update(JSON.stringify({ params: LAYOUT_PARAMS, runs: RUNS, slots: SLOT_PLACEMENT, island: ISLAND, cabinets: CABINETS, selection: store().selection }))
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

describe("the ten v=2 links round 98b-1 wrote", () => {
  it("is ten: five packages, in the L and on one wall", () => {
    expect(LINKS.length).toBe(10);
  });

  describe.each(LINKS)("%s", (_name, fixture) => {
    it("opens the room 98b-1 opened, every run, machine, cabinet box and model — but E on one wall", () => {
      freshPage();
      openSharedLink(fixture.link);
      expect(held() === fixture.room).toBe(_name !== CHANGED_BY_98B2);
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
