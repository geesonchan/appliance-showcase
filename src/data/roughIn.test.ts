import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { checkLayout } from "./layoutRules";
import { hasGenericRoughIn, resolveRoughIn, roughInFor, roughInSentence } from "./roughIn";
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
    const outlet = roughInFor(model("thermador-md24bs"))!.points[0];
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
    // The stray id has no entry, so nothing to check: the rule reads drawings.
    expect(checkLayout(undefined, { "slot-dishwasher": strayed })).toEqual([]);
  });
});
