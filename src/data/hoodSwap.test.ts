import { afterAll, describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates";
import { APPLIANCES, APPLIANCE_BY_ID } from "./catalogue";
import { hoodMount } from "./hoodMount";
import { setActivePackage, setHoodModel } from "./layoutState";
import { BUILDABLE_PACKAGES, PACKAGE_BY_ID } from "./packages";
import { RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";

/**
 * Round 87, Leo: what is over a hood is the chosen hood's to say, not the
 * package's. From Leo using package A — its under-cabinet hood changed on the
 * model card to the insert liner VCIN36GWS, which hung on its own between the
 * wall cabinets with no housing. **Leo's site practice:** an insert hood always
 * comes with its housing, as a rangetop always has a base cabinet under it
 * (D16, round 83). And every other swap follows the same answer (`hoodMount`):
 * an under-cabinet hood has a bridge cabinet over it, a chimney hood nothing,
 * its duct through the ceiling.
 *
 * Every package, every hood its opening takes, picked the way the model card
 * picks it (`setHoodModel`), against figures written out here rather than read
 * back from the code. And B's and D's opening is 36" now (Leo, round 87: "36"
 * Range 就直接配 36" Hood 就好，因为 42" 现在很少家电品牌做").
 */
afterAll(() => resetRoom());

/** What stands over the hood, from the wall cabinets the room built. */
function over(): string {
  for (const run of RUNS) {
    for (const bank of run.uppers) {
      const module = bank.modules.find((candidate) => candidate.slot === "slot-hood");
      if (module) return `${module.kind === "hood-cabinet" ? "housing" : module.kind} ${module.widthIn}`;
    }
  }
  return "nothing";
}

const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000;

/** The hood in the room after picking it: what is over it, where it hangs, where its duct goes. */
function swapTo(code: string, hoodId: string) {
  resetRoom();
  if (!setActivePackage(`package-${code.toLowerCase()}`).ok) throw new Error(`${code}: room refused`);
  // Read off the room, not the return value, so that run on round 86's code
  // (which returned nothing) each case is red for what it says.
  const result = setHoodModel(APPLIANCE_BY_ID[hoodId]) as { ok: boolean } | undefined;
  const slot = SLOT_BY_ID["slot-hood"];
  return {
    ok: result?.ok !== false,
    over: over(),
    hangsAtIn: inches(slot.position[1]),
    route: slot.utilities.duct?.route ?? null,
  };
}

const short = (id: string) => id.replace(/^[a-z]+-/, "");

describe("what is over a hood follows the hood chosen (round 87)", () => {
  it("is the housing, a bridge or nothing, hung and ducted as the hood hangs, for every hood every opening takes", () => {
    const seen: Record<string, string> = {};
    for (const entry of BUILDABLE_PACKAGES) {
      resetRoom();
      setActivePackage(entry.id);
      const fitting = candidatesFor("slot-hood", entry).filter(({ fit }) => fit.fits);
      for (const { appliance } of fitting) {
        const r = swapTo(entry.code, appliance.id);
        seen[`${entry.code} ${short(appliance.id)}`] = `${r.ok ? "" : "REFUSED "}${r.over} at ${r.hangsAtIn} ${r.route}`;
      }
    }
    expect(seen).toEqual({
      // A: the counter the wall was drilled for is 36-3/4", so a hood hangs at
      // 66-3/4"; a chimney's cover reaches the ceiling from there too.
      "A ak7136bs-bf": "bridge 36 at 66.75 up-through-cabinet",
      "A ak7300as": "bridge 36 at 66.75 up-through-cabinet",
      "A vcin36gws": "housing 36 at 66.75 up-through-cabinet",
      "A hmwb361ws": "bridge 36 at 66.75 up-through-cabinet",
      "A ph36hws": "bridge 36 at 66.75 up-through-cabinet",
      "A hmcb30ws": "nothing at 66.75 through-ceiling",
      // B and D: 36-7/16" of rangetop, so 66-7/16"; a chimney goes up to
      // 66-1/2" so its cover reaches the 108-1/2" ceiling (D19).
      "B ak7136bs-bf": "bridge 36 at 66.438 up-through-cabinet",
      "B ak7300as": "bridge 36 at 66.438 up-through-cabinet",
      "B vcin36gws": "housing 36 at 66.438 up-through-cabinet",
      "B hmwb361ws": "bridge 36 at 66.438 up-through-cabinet",
      "B ph36hws": "bridge 36 at 66.438 up-through-cabinet",
      "B hmcb30ws": "nothing at 66.5 through-ceiling",
      // C: a 36" range; its own chimney hood hangs at 66-1/2" as before, an
      // under-cabinet one at the 30" minimum with a cabinet to hang from.
      "C ak7300as": "bridge 30 at 66 up-through-cabinet",
      "C hmcb30ws": "nothing at 66.5 through-ceiling",
      "D ak7136bs-bf": "bridge 36 at 66.438 up-through-cabinet",
      "D ak7300as": "bridge 36 at 66.438 up-through-cabinet",
      "D vcin36gws": "housing 36 at 66.438 up-through-cabinet",
      "D hmwb361ws": "bridge 36 at 66.438 up-through-cabinet",
      "D ph36hws": "bridge 36 at 66.438 up-through-cabinet",
      "D hmcb30ws": "nothing at 66.5 through-ceiling",
      // E: hung from the ceiling over the island at 72" (D20).
      "E hmib42ws": "nothing at 72 through-ceiling",
    });
  });

  it("gives package A's insert liner a housing, Leo's case", () => {
    expect(swapTo("A", "thermador-vcin36gws").over).toBe("housing 36");
  });

  it("takes package B's housing away for an under-cabinet hood, and puts a bridge over it", () => {
    expect(swapTo("B", "thermador-ph36hws").over).toBe("bridge 36");
  });

  it("leaves nothing over a chimney hood in package A, and sends its duct through the ceiling", () => {
    const r = swapTo("A", "thermador-hmcb30ws");
    expect({ over: r.over, route: r.route }).toEqual({ over: "nothing", route: "through-ceiling" });
  });

  it("hangs an under-cabinet hood in package C at the 30-inch minimum, under a bridge", () => {
    const r = swapTo("C", "zephyr-ak7300as");
    expect({ over: r.over, hangsAtIn: r.hangsAtIn }).toEqual({ over: "bridge 30", hangsAtIn: 66 });
  });

  it("builds the room again only when the hood hangs differently", () => {
    resetRoom();
    setActivePackage("package-a");
    const sameKind = setHoodModel(APPLIANCE_BY_ID["zephyr-ak7300as"]).rebuilt;
    const otherKind = setHoodModel(APPLIANCE_BY_ID["thermador-vcin36gws"]).rebuilt;
    expect({ sameKind, otherKind }).toEqual({ sameKind: false, otherKind: true });
  });

  it("builds each package's own room round its own hood after a swap in another package", () => {
    resetRoom();
    setActivePackage("package-a");
    setHoodModel(APPLIANCE_BY_ID["thermador-vcin36gws"]);
    setActivePackage("package-c");
    expect(over()).toBe("nothing");
  });
});

describe("how every hood in the catalogue hangs (round 87)", () => {
  // A hood that says nothing about how it hangs is refused loudly rather than
  // guessed at (D4: the importer's "freestanding" default is not an answer).
  it("is said by each one's own install type", () => {
    const hoods = APPLIANCES.filter((appliance) => appliance.category === "hood");
    const mounts = Object.fromEntries(hoods.map((hood) => [short(hood.id), hoodMount(hood)]));
    expect({ hoods: hoods.length, mounts }).toEqual({
      hoods: 7,
      mounts: {
        "ak7136bs-bf": "under-cabinet",
        ak7300as: "under-cabinet",
        vcin36gws: "insert",
        hmwb361ws: "under-cabinet",
        ph36hws: "under-cabinet",
        hmcb30ws: "chimney",
        hmib42ws: "island",
      },
    });
  });
});

describe("B's and D's hood opening (round 87)", () => {
  it("is 36 inches, the range's width, in both", () => {
    const widths = ["package-b", "package-d"].map(
      (id) => PACKAGE_BY_ID[id].slots.find((slot) => slot.slotId === "slot-hood")!.widthIn,
    );
    expect(widths).toEqual([36, 36]);
  });
});
