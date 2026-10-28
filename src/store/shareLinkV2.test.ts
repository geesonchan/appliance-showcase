import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { CABINETS } from "../data/cabinets";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PACKAGE, PACKAGES } from "../data/packages";
import { ISLAND, LAYOUT_PARAMS, RUNS, SLOT_PLACEMENT } from "../data/room";
import { resetRoom } from "../data/testRoom";
import { kitchenNow, openSharedLink } from "./openLink";
import ROUND_97 from "./shareLink.round97.json";
import { readLink, writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";

/**
 * A link carries the layout's shape, and says so with its version: `v=2`.
 * Round 98a, Leo: "分享链接升到 v=2：v=1 旧链接一律当 L 型打开，不提示，房间和
 * 第 97 轮完全一样" (docs/decisions.md D23).
 *
 * The `v=1` links here were written by round 97's own code, not by this one
 * (`shareLink.round97.json`, with how): a link written today would carry
 * whatever today's table writes, and could not show that an old one still opens.
 */

const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();

function freshPage() {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
}

/**
 * The room as round 97 held it, hashed as round 97 hashed it: the same five
 * things, with what a later round added to a record left out — the layout's
 * `shape` and a run's `facing` (round 98a). Each is asked for on its own below.
 */
function roomAsRound97Held() {
  const { shape: _shape, ...params } = LAYOUT_PARAMS as typeof LAYOUT_PARAMS & { shape?: unknown };
  const runs = RUNS.map((run) => ({ id: run.id, axis: run.axis, centre: run.centre, segments: run.segments, uppers: run.uppers }));
  return createHash("sha256")
    .update(JSON.stringify({ params, runs, slots: SLOT_PLACEMENT, island: ISLAND, cabinets: CABINETS }))
    .digest("hex");
}

const LINKS = Object.entries(ROUND_97.links);

/**
 * Package A's and C's, which open a different room since the fridge-front
 * round, because Leo changed the room (2026-10-24 and 2026-10-27): a built-in
 * refrigerator — T36IT100NP in A's link, T36BT120NS in C's — stands between a
 * 3/4" side panel and, at the return wall both links have, 3-1/2" of filler,
 * where it stood in a 42" enclosure. The walls and the island are as round 97
 * opened them; the runs and the cabinet boxes are the new ones, and in A the
 * machine's place. Hashed as `roomAsRound97Held` hashes, on this round's code.
 */
const CHANGED_BY_FRIDGE_FRONT: Record<string, string> = {
  A: "1f2fb7277ae30ca4cee5f573f07baf3a8b9f2a4633e932b3904590a70fe45122",
  C: "c68cb482941445da8e0c5222f12ed8c280ada84d4181da44d072d36f9fe96708",
};

describe("the five links round 97 wrote, one per package", () => {
  it("is five, one per package that builds", () => {
    expect(LINKS.map(([code]) => code)).toEqual(PACKAGES.filter((entry) => entry.available).map((entry) => entry.code));
  });

  describe.each(LINKS)("package %s", (code, fixture) => {
    it("opens as an L", () => {
      freshPage();
      openSharedLink(fixture.link);
      expect((LAYOUT_PARAMS as { shape?: unknown }).shape).toBe("L");
    });

    it("says nothing on opening", () => {
      freshPage();
      openSharedLink(fixture.link);
      expect(store().toast).toBeNull();
    });

    it("opens the room round 97 opened, every run, opening and cabinet box", () => {
      freshPage();
      openSharedLink(fixture.link);
      expect(roomAsRound97Held()).toBe(CHANGED_BY_FRIDGE_FRONT[code] ?? fixture.room);
    });
  });
});

/** A link written from package A as it opens, with some fields put in by hand. */
function linkWith(changes: Record<string, string | null>) {
  freshPage();
  const query = new URLSearchParams(writeLink(kitchenNow()));
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) query.delete(key);
    else query.set(key, value);
  }
  return `?${query.toString()}`;
}

const fields = () => {
  const lines = store().toast?.notice;
  return Array.isArray(lines) ? lines.map((line) => line.field) : lines;
};

describe("a link written now", () => {
  it("says it is version 2 and carries the shape", () => {
    freshPage();
    const query = new URLSearchParams(writeLink(kitchenNow()));
    expect({ v: query.get("v"), shape: query.get("shape") }).toEqual({ v: "2", shape: "L" });
  });

  it("is read as a link", () => {
    freshPage();
    expect(readLink(new URLSearchParams(writeLink(kitchenNow())))).toEqual({ kind: "link", packageId: DEFAULT_PACKAGE.id });
  });

  it("says so when a version 2 link has no shape, and shows an L", () => {
    openSharedLink(linkWith({ shape: null }));
    expect({ lines: fields(), shape: (LAYOUT_PARAMS as { shape?: unknown }).shape }).toEqual({ lines: ["shape"], shape: "L" });
  });

  it("says so when a version 2 link names a shape this page does not build, and shows an L", () => {
    openSharedLink(linkWith({ shape: "U" }));
    expect({ lines: fields(), shape: (LAYOUT_PARAMS as { shape?: unknown }).shape }).toEqual({ lines: ["shape"], shape: "L" });
  });

  it("still cannot read a version it does not know", () => {
    freshPage();
    openSharedLink("?v=3&pkg=D&shape=L");
    expect({ notice: store().toast?.notice, pkg: store().packageId }).toEqual({ notice: "unreadable", pkg: DEFAULT_PACKAGE.id });
  });
});
