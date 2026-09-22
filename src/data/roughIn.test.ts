import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { checkLayout } from "./layoutRules";
import {
  ROUGH_IN,
  hasGenericRoughIn,
  lineTier,
  orphanRoughInKeys,
  resolveRoughIn,
  roughInCalloutKey,
  roughInFor,
  roughInSentence,
} from "./roughIn";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import { ROOM } from "./room";
import { SLOT_ORDER } from "./catalogue";
import type { Appliance, SlotId } from "../types";

const inches = (feet: number) => feet * 12;
const model = (id: string) => APPLIANCE_BY_ID[id];
const inside = (
  position: [number, number, number],
  host: { min: [number, number, number]; max: [number, number, number] },
) =>
  position.every(
    (value, axis) => value >= host.min[axis] - 1e-6 && value <= host.max[axis] + 1e-6,
  );

describe("every connection lands inside the box it was declared in", () => {
  const cases: [SlotId, string][] = [
    ["slot-microwave", "thermador-md24bs"],
    ["slot-dishwasher", "bosch-shv78cm3n"],
    ["slot-fridge", "thermador-t36bt120ns"],
    ["slot-hood", "thermador-ph36hws"],
  ];

  it.each(cases)("%s: %s", (slotId, id) => {
    const appliance = model(id);
    expect(appliance, `${id} is not in the catalogue`).toBeDefined();
    const points = resolveRoughIn(slotId, appliance);
    expect(points.length).toBeGreaterThan(0);
    for (const resolved of points) {
      expect(
        inside(resolved.position, resolved.host),
        `${id} ${resolved.point.type} is outside ${resolved.host.id}`,
      ).toBe(true);
    }
  });

  it("puts the dishwasher's three services in the sink base, not its own opening", () => {
    const points = resolveRoughIn("slot-dishwasher", model("bosch-shv78cm3n"));
    const types = points.map((p) => p.point.type);
    expect(types).toEqual(expect.arrayContaining(["power", "water", "drain"]));
    for (const resolved of points) {
      expect(resolved.point.location).toBe("under-sink");
      expect(resolved.host.id).toContain("sink");
    }
  });

  it("puts the refrigerator's supply in a neighbouring cabinet, not in its opening", () => {
    const points = resolveRoughIn("slot-fridge", model("thermador-t36bt120ns"));
    const services = points.filter((p) => p.point.type !== "service-channel");
    expect(services.length).toBeGreaterThan(0);
    const tower = resolveRoughIn("slot-fridge", model("thermador-t36bt120ns")).find(
      (p) => p.point.location === "in-cutout",
    )!;
    for (const resolved of services) {
      expect(resolved.point.location).toMatch(/^adjacent-cabinet-/);
      // A different box from the tower's own opening.
      expect(resolved.host.id).not.toBe(tower.host.id);
    }
  });
});

describe("the numbers off the drawings", () => {
  // Leo's check: the outlet has to be reachable from inside the cabinet, which
  // means below the counter, not behind it.
  it("keeps the microwave's outlet below the counter", () => {
    const outlet = resolveRoughIn("slot-microwave", model("thermador-md24bs")).find(
      (p) => p.point.type === "power",
    )!;
    expect(outlet).toBeDefined();
    expect(outlet.position[1]).toBeLessThan(ROOM.counterHeight);
    expect(inches(outlet.position[1])).toBeGreaterThan(0);
  });

  it("takes the microwave's outlet from the model rather than a room-wide height", () => {
    const entry = roughInFor(model("thermador-md24bs"))!;
    const outlet = entry.points.find((p) => p.type === "power")!;
    expect(outlet.x).toBe(4);
    expect(outlet.y).toBe(14.625);
    expect(outlet.z).toBe("rear");
  });

  it("peaks the dishwasher's drain loop between 33 and 43 inches", () => {
    const drain = resolveRoughIn("slot-dishwasher", model("bosch-shv78cm3n")).find(
      (p) => p.point.type === "drain",
    )!;
    expect(drain.highLoopY).not.toBeNull();
    expect(inches(drain.highLoopY!)).toBeGreaterThanOrEqual(33);
    expect(inches(drain.highLoopY!)).toBeLessThanOrEqual(43);
  });

  it("puts the hood's electrical zone above the canopy, against the wall", () => {
    const power = resolveRoughIn("slot-hood", model("thermador-ph36hws"))[0];
    expect(power.point.location).toBe("above-cabinet");
    expect(power.position[1]).toBeGreaterThan(ROOM.upperBottom);
  });

  it("names where each connection is, in the terms a manual uses", () => {
    const outlet = resolveRoughIn("slot-microwave", model("thermador-md24bs"))[0];
    expect(outlet.point).toBe(roughInFor(model("thermador-md24bs"))!.points[0]);
    const said = roughInSentence(outlet);
    expect(said.where).toBe("rear wall of the opening");
    expect(said.at).toContain('4"');
    expect(said.at).toContain('14-5/8"');
  });
});

describe("a model nobody has measured falls back and says so", () => {
  it("has no points, and is marked generic", () => {
    const unknown = { ...model("thermador-md24bs"), id: "not-in-the-file" } as Appliance;
    expect(resolveRoughIn("slot-microwave", unknown)).toEqual([]);
    expect(hasGenericRoughIn(unknown)).toBe(true);
    expect(hasGenericRoughIn(model("thermador-md24bs"))).toBe(false);
  });

  it("leaves the room's own layout passing either way", () => {
    expect(checkLayout()).toEqual([]);
  });
});

describe("D11 rule 8 · the dishwasher's services are in the sink base", () => {
  const selection = () =>
    Object.fromEntries(
      SLOT_ORDER.map((slotId) => [slotId, undefined]),
    ) as Partial<Record<SlotId, Appliance>>;

  it("passes for the dishwasher the room ships with", () => {
    const withDishwasher = { ...selection(), "slot-dishwasher": model("bosch-shv78cm3n") };
    expect(checkLayout(undefined, withDishwasher)).toEqual([]);
  });

  it("catches a dishwasher whose services are somewhere else", () => {
    const strayed = {
      ...model("bosch-shv78cm3n"),
      id: "stray-dishwasher",
    } as Appliance;
    // The stray id has no entry, so nothing to check: the rule reads rough-in
    // entries.
    expect(checkLayout(undefined, { "slot-dishwasher": strayed })).toEqual([]);
  });
});

describe("D21 · a line says where its figure comes from", () => {
  const FIRST_BATCH: Record<string, Record<string, string>> = {
    "thermador-t36bt120ns": { power: "inferred", water: "inferred", "service-channel": "inferred" },
    "thermador-md24bs": { power: "uncertain", "anti-tip": "drawing" },
    "bosch-shv78cm3n": { power: "site", water: "site", drain: "inferred", "air-gap": "inferred" },
  };

  it.each(Object.entries(FIRST_BATCH))("classifies every point of %s as Leo gave it", (id, expected) => {
    const points = roughInFor(model(id))!.points;
    expect(Object.fromEntries(points.map((p) => [p.type, p.provenance]))).toEqual(expected);
    for (const point of points) {
      // Anything short of a drawing says which of its figures are from where.
      if (point.provenance !== "drawing") expect(point.basis, `${id} ${point.type}`).toBeTruthy();
    }
  });

  it("draws each point in one of three looks, one meaning each", () => {
    const md24bs = roughInFor(model("thermador-md24bs"))!.points;
    expect(lineTier(md24bs.find((p) => p.type === "anti-tip")!)).toBe("confirmed");
    expect(lineTier(md24bs.find((p) => p.type === "power")!)).toBe("unconfirmed");
    for (const point of roughInFor(model("bosch-shv78cm3n"))!.points) {
      expect(lineTier(point), point.type).toBe("unconfirmed");
    }
    // Not yet reviewed is its own, weaker look — never the confirmed one, which
    // is the reading that put a certain pipe onto an uncertain fitting.
    const hood = roughInFor(model("thermador-ph36hws"))!.points[0];
    expect(hood.provenance).toBeNull();
    expect(lineTier(hood)).toBe("unreviewed");
  });

  it("has a callout, in both languages, that names the source", () => {
    const kinds = ["drawing", "site", "inferred", "uncertain", null] as const;
    for (const provenance of kinds) {
      const key = roughInCalloutKey({ ...roughInFor(model("thermador-md24bs"))!.points[0], provenance });
      expect((en as Record<string, string>)[key], key).toBeTruthy();
      expect((zh as Record<string, string>)[key], key).toBeTruthy();
      if (provenance !== "drawing" && provenance !== null) {
        expect((en as Record<string, string>)[key]).toMatch(/to confirm/);
      }
    }
  });

  // Classifying a point is not a licence to move it.
  it("leaves every position in the first batch where it was", () => {
    const at = (id: string) =>
      roughInFor(model(id))!.points.map((p) => [p.type, p.location, p.x, p.y, p.z, p.size, p.highLoopApexIn]);
    expect(at("thermador-t36bt120ns")).toEqual([
      ["power", "adjacent-cabinet-right", 6, 6, "rear", null, null],
      ["water", "adjacent-cabinet-right", 12, 6, "rear", null, null],
      ["service-channel", "in-cutout", "center", "bottom", "rear", [36, 7.25, 2], null],
    ]);
    expect(at("thermador-md24bs")).toEqual([
      ["power", "in-cutout", 4, 14.625, "rear", null, null],
      ["anti-tip", "in-cutout", "center", "top", "rear", [6, 3.5, 1.5], null],
    ]);
    expect(at("bosch-shv78cm3n")).toEqual([
      ["power", "under-sink", 6, 6, "rear", null, null],
      ["water", "under-sink", 12, 8, "rear", null, null],
      ["drain", "under-sink", 18, 10, "rear", null, 38],
      ["air-gap", "under-sink", 24, "top", "rear", [2, 3, 2], null],
    ]);
  });
});

describe("every rough-in entry names a model in the catalogue", () => {
  it("has no key the catalogue does not know", () => {
    expect(orphanRoughInKeys(Object.keys(ROUGH_IN), Object.keys(APPLIANCE_BY_ID))).toEqual([]);
  });

  it("catches a misspelt key", () => {
    expect(
      orphanRoughInKeys(["thermador-vcin36ws", "thermador-md24bs"], Object.keys(APPLIANCE_BY_ID)),
    ).toEqual(["thermador-vcin36ws"]);
  });
});
