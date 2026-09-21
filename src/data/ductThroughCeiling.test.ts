import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import packagesFile from "../../data/packages.json";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import { assertHoodRoute, ceilingStub, ductCallout, hoodOutlet, outletSize } from "./hood";
import { setActivePackage } from "./layoutState";
import { PACKAGE_BY_ID } from "./packages";
import { ROOM, ft } from "./room";
import { packagesFileSchema, parseDataFile } from "./schema";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance, Package, Slot } from "../types";

/**
 * A duct that goes up through a ceiling says so. Round 58, D22 step 3's fifth
 * item.
 *
 * The routes were `up-through-cabinet`, `back-wall` and `recirc`, and two hoods
 * that ship or will ship are none of them. Package C's chimney hood runs its
 * cover to the ceiling with no cabinet over it, and its spec card said "Up
 * through cabinet" — looked at on the live site in round 58, not supposed. An
 * island hood has nothing over it but the ceiling, and HMIB42WS's guide names
 * "venting through the ceiling" as one of its two configurations, with an 8"
 * round transition and 8" round duct (pages 11-12). Its geometry already ran up
 * whatever the route said (round 52); the words did not, and nor did the size
 * of its outlet, which was the wall canopy's rectangular collar.
 *
 * Every figure here is written out from the guide, the sheet or the room.
 */

const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;
const E_ID = "test-duct-through-ceiling";

/** Package E's shape, its island hood ducted the way its guide shows. */
function packageE(route: string): Package {
  // Package E itself since round 69 — one copy of E, in data/packages.json
  // (D17) — in the 240" room these cases were written in.
  // The route is the case's: the hood slot declares it.
  const e = PACKAGE_BY_ID["package-e"];
  return {
    ...e,
    id: E_ID,
    defaultLayout: { ...e.defaultLayout, backWallIn: 240 },
    slots: e.slots.map((slot) =>
      slot.slotId === "slot-hood"
        ? { ...slot, utilities: { gas: null, power: null, duct: { diameterIn: 8, route } } }
        : slot,
    ),
  } as Package;
}

const activate = (route: string) => {
  PACKAGE_BY_ID[E_ID] = packageE(route);
  resetRoom();
  return setActivePackage(E_ID);
};

afterAll(() => {
  delete PACKAGE_BY_ID[E_ID];
  resetRoom();
});

describe("the data can say a duct goes through the ceiling", () => {
  it("accepts through-ceiling as a route in a package's file", () => {
    const raw = structuredClone(packagesFile) as unknown as {
      packages: { id: string; slots: { slotId: string; utilities?: unknown }[] }[];
    };
    const c = raw.packages.find((entry) => entry.id === "package-c")!;
    const hood = c.slots.find((slot) => slot.slotId === "slot-hood")!;
    hood.utilities = { duct: { diameterIn: 8, route: "through-ceiling" } };
    expect(() => parseDataFile(packagesFileSchema, raw, "packages.json (test)")).not.toThrow();
  });

  it("names it in both languages, the way the spec card asks for it", () => {
    expect((en as Record<string, string>)["duct.through-ceiling"]).toBeTruthy();
    expect((zh as Record<string, string>)["duct.through-ceiling"]).toBeTruthy();
  });
});

describe("package C's chimney hood goes through the ceiling, not a cabinet", () => {
  it("is declared through-ceiling in the data", () => {
    const hood = PACKAGE_BY_ID["package-c"].slots.find((slot) => slot.slotId === "slot-hood")!;
    expect(hood.utilities?.duct?.route).toBe("through-ceiling");
  });

  it("leaves A, B and D, whose hoods do sit under a cabinet or inside a housing, as they were", () => {
    for (const id of ["package-a", "package-b", "package-d"]) {
      resetRoom();
      expect(setActivePackage(id).ok).toBe(true);
      expect(SLOT_BY_ID["slot-hood"].utilities.duct?.route, id).toBe("up-through-cabinet");
    }
  });
});

describe("a hood hung over an island", () => {
  it("builds with the route its guide shows", () => {
    expect(activate("through-ceiling").ok).toBe(true);
    expect(SLOT_BY_ID["slot-hood"].mount).toBe("island");
  });

  it("builds recirculating, which needs no route through anything", () => {
    expect(activate("recirc").ok).toBe(true);
  });

  it("refuses to be told its duct goes up through a cabinet it does not have", () => {
    expect(() => activate("up-through-cabinet")).toThrow(/slot-hood.*up-through-cabinet/);
  });

  it("refuses to be told its duct goes out through a wall behind it", () => {
    expect(() => activate("back-wall")).toThrow(/slot-hood.*back-wall/);
  });

  it("gives its outlet as the guide's 8-inch round transition, not the wall canopy's collar", () => {
    expect(activate("through-ceiling").ok).toBe(true);
    expect(outletSize()).toBe('8" round');
  });
});

describe("a duct through the ceiling, in the install view", () => {
  const hung = (): Slot =>
    ({ ...SLOT_BY_ID["slot-hood"], position: [1.5, ft(72), 2.75], rotationY: 0, mount: "island" }) as Slot;

  it("is drawn a short way past the ceiling, straight up from the outlet", () => {
    resetRoom();
    const slot = hung();
    const outlet = hoodOutlet(slot, byModel("HMIB42WS"));
    const stub = ceilingStub(slot, outlet, "through-ceiling");
    expect(stub, "a stub is drawn").not.toBeNull();
    expect(stub!.from).toEqual([outlet.position[0], ROOM.wallHeight, outlet.position[2]]);
    expect(stub!.to[0]).toBe(outlet.position[0]);
    expect(stub!.to[2]).toBe(outlet.position[2]);
    expect(stub!.to[1]).toBeCloseTo(ROOM.wallHeight + ft(12), 9);
  });

  it("is dashed grey: the configuration is in the guide, the duct's place in the hood is inferred", () => {
    resetRoom();
    const slot = hung();
    const stub = ceilingStub(slot, hoodOutlet(slot, byModel("HMIB42WS")), "through-ceiling");
    expect(stub?.tier).toBe("unconfirmed");
  });

  it("is not drawn for any other route", () => {
    resetRoom();
    const slot = hung();
    const outlet = hoodOutlet(slot, byModel("HMIB42WS"));
    for (const route of ["up-through-cabinet", "back-wall", "recirc"]) {
      expect(ceilingStub(slot, outlet, route), route).toBeNull();
    }
  });

  it("is not drawn for package C's chimney hood, whose guide is not in the repo", () => {
    resetRoom();
    expect(setActivePackage("package-c").ok).toBe(true);
    const wall = SLOT_BY_ID["slot-hood"];
    const outlet = hoodOutlet(wall, byModel("HMCB30WS"));
    expect(ceilingStub(wall, outlet, "through-ceiling")).toBeNull();
  });

  it("says where it goes and where that is written, when it is clicked", () => {
    const callout = ductCallout(hung(), "through-ceiling");
    expect(callout.key).toBe("duct.calloutCeiling");
    for (const words of [en, zh] as Record<string, string>[]) {
      expect(words[callout.key]).toBeTruthy();
      expect(words[callout.key]).toContain("12");
    }
  });

  it("keeps the cabinet's callout for a duct that does go up through a cabinet", () => {
    resetRoom();
    expect(ductCallout(SLOT_BY_ID["slot-hood"], "up-through-cabinet").key).toBe("duct.callout");
  });

  it("tells package C's chimney hood its duct rises in the chimney, with no cabinet in it", () => {
    resetRoom();
    expect(setActivePackage("package-c").ok).toBe(true);
    const callout = ductCallout(SLOT_BY_ID["slot-hood"], "through-ceiling");
    expect(callout.key).toBe("duct.calloutChimney");
    for (const words of [en, zh] as Record<string, string>[]) {
      expect(words[callout.key]).toBeTruthy();
      // And not the cabinet's sentence, which is what it used to be given.
      expect(words[callout.key]).not.toBe(words["duct.callout"]);
    }
  });
});

describe("the route check itself", () => {
  it("lets a wall hood keep up-through-cabinet", () => {
    resetRoom();
    expect(() => assertHoodRoute(SLOT_BY_ID["slot-hood"])).not.toThrow();
  });
});
