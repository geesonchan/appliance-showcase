import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { OVERHANG_SUPPORT, needsOverhangSupport, overhangSupportZone } from "./overhang";
import { BUILDABLE_PACKAGES, PACKAGE_BY_ID } from "./packages";
import { ISLAND, REQUESTED_PARAMS, ROOM, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import { testPackageE } from "./testPackageE";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { pinAnchors } from "../three/pinAnchor";
import type { Appliance, SlotId } from "../types";

/**
 * Package E's 15" seating overhang, and its island hood's label. Round 68.
 *
 * The overhang: 3cm quartz carries about 10"-12" unsupported (D20, secondary
 * trade experience), and the support is concealed steel plate (Leo's site
 * practice). Concealed means the finished room shows nothing, so the install
 * checklist has to say it — the picture and the list may not both be silent
 * (D20, round 54's principle). One assertion per test, so a red one names its
 * own point.
 */
const E_ID = "test-overhang-island-cooking";

function selectionOf(id: string) {
  const pkg = PACKAGE_BY_ID[id];
  const selection = Object.fromEntries(
    Object.entries(pkg.defaultSelection).map(([slot, applianceId]) => [slot, APPLIANCE_BY_ID[applianceId as string]]),
  ) as Record<SlotId, Appliance>;
  const blower = pkg.defaultBlower ? (APPLIANCE_BY_ID[pkg.defaultBlower] ?? null) : null;
  return { selection, blower };
}

function openE() {
  PACKAGE_BY_ID[E_ID] = testPackageE(E_ID);
  resetRoom();
  const result = setActivePackage(E_ID);
  if (!result.ok) throw new Error(`E will not build: ${JSON.stringify(result.reasons)}`);
}

const supportLines = (id: string) => {
  const { selection, blower } = selectionOf(id);
  return checklistFor(selection, blower).findings.filter((f) => f.ruleId === "overhang-support");
};

/** A zone's size on plan, in inches, x then z. */
const planSize = (corners: [number, number, number][]) => {
  const xs = corners.map((c) => c[0]);
  const zs = corners.map((c) => c[2]);
  return [(Math.max(...xs) - Math.min(...xs)) * 12, (Math.max(...zs) - Math.min(...zs)) * 12].map(
    (v) => Math.round(v * 1000) / 1000,
  );
};

beforeEach(() => resetRoom());
afterAll(() => {
  delete PACKAGE_BY_ID[E_ID];
  resetRoom();
});

describe("how far a stone top carries on its own", () => {
  it("asks nothing at 10\"", () => {
    expect(needsOverhangSupport(10)).toBe(false);
  });

  it("asks for support at 10-1/2\", inside the 10-12 range that is itself the question", () => {
    expect(needsOverhangSupport(10.5)).toBe(true);
  });

  it("is concealed steel plate, Leo's practice", () => {
    expect(OVERHANG_SUPPORT.kind).toBe("concealed-steel-plate");
  });
});

describe("package E's 15\" overhang on the install checklist", () => {
  it("puts one support line on the list", () => {
    openE();
    expect(supportLines(E_ID)).toHaveLength(1);
  });

  it("files it under the cooktop, a slot the room has, not the hood over it", () => {
    openE();
    expect(supportLines(E_ID)[0]?.slot).toBe("slot-cooktop");
  });

  it("says nothing in any package with no overhang", () => {
    const withLine = BUILDABLE_PACKAGES.filter((entry) => {
      resetRoom();
      setActivePackage(entry.id);
      return supportLines(entry.id).length > 0;
    }).map((entry) => entry.id);
    expect(withLine).toEqual([]);
  });
});

describe("where the support goes", () => {
  it("runs the top's whole length and 15\" out, with the island along the back wall", () => {
    openE();
    // 72" of island and the 1" lap at each end, by 15" of overhang: lopsided,
    // so a zone turned the wrong way cannot pass.
    expect(planSize(overhangSupportZone(ISLAND)!.corners)).toEqual([74, 15]);
  });

  it("turns with the island when it is laid across the room", () => {
    openE();
    const turned = setLayoutParams({ ...REQUESTED_PARAMS, islandOrientation: "perpendicular", leftWallIn: 216 });
    if (!turned.ok) throw new Error(`E will not turn its island: ${JSON.stringify(turned.reasons)}`);
    expect(planSize(overhangSupportZone(ISLAND)!.corners)).toEqual([15, 74]);
  });

  it("reaches out from the seating face, the side people sit at", () => {
    openE();
    const corners = overhangSupportZone(ISLAND)!.corners;
    const acrossOf = (c: [number, number, number]) => (ISLAND.axis === "x" ? c[2] : c[0]);
    const far = corners.map(acrossOf).reduce((a, b) =>
      Math.abs(b - ISLAND.working) > Math.abs(a - ISLAND.working) ? b : a,
    );
    // Measured from the working face, the far edge is the island's depth plus
    // the overhang: 24" + 15".
    expect(Math.round(Math.abs(far - ISLAND.working) * 12 * 1000) / 1000).toBe(39);
  });

  it("sits on the underside of the stone", () => {
    openE();
    const ys = new Set(overhangSupportZone(ISLAND)!.corners.map((c) => c[1]));
    expect([...ys]).toEqual([ROOM.counterHeight - ROOM.counterThickness]);
  });
});

describe("the island hood's label", () => {
  it("hangs on the canopy, not five feet under it at the counter", () => {
    openE();
    const hood = APPLIANCE_BY_ID[PACKAGE_BY_ID[E_ID].defaultSelection["slot-hood"] as string];
    const slot = SLOT_BY_ID["slot-hood"];
    // The canopy's top: its underside, where the slot stands, and 2-3/4" of canopy.
    const canopyTop = slot.position[1] + ft(2.75);
    const heights = pinAnchors("slot-hood", hood).map((p) => Math.round(p.y * 12 * 1000) / 1000);
    expect(heights).toEqual(heights.map(() => Math.round(canopyTop * 12 * 1000) / 1000));
  });

  it("leaves the cooktop's label over the counter, where island machines keep theirs", () => {
    openE();
    const cooktop = APPLIANCE_BY_ID[PACKAGE_BY_ID[E_ID].defaultSelection["slot-cooktop"] as string];
    const [anchor] = pinAnchors("slot-cooktop", cooktop);
    expect(anchor.y).toBeCloseTo(ROOM.counterHeight + 0.7, 9);
  });
});
