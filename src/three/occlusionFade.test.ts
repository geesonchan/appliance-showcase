import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { blocksSightLine, isAppliance, owningSlot, sightLineLayers } from "./OcclusionFade";

/**
 * What may be faded off a sight line, and what may not. Round 55.
 *
 * The fade was written for joinery, because in packages A to D nothing but
 * joinery ever stands between the camera and a machine. Package E hangs a 42"
 * hood in the middle of the room, and flying to the combination oven behind it
 * put the hood across its face — solid, because appliances were not cast
 * against at all.
 */
describe("what a sight line is cast against", () => {
  it("includes the appliances in the modes a customer looks at", () => {
    for (const mode of ["realistic", "white"]) {
      expect(sightLineLayers(mode)).toContain("appliance-layer");
    }
  });

  it("leaves them out in install mode, which has already stepped them back", () => {
    // Both writes save and restore the same materials, so each would restore
    // what the other had saved. Install mode fades them further than this does.
    expect(sightLineLayers("install")).not.toContain("appliance-layer");
  });

  it("keeps the joinery in every mode, which is what it was written for", () => {
    for (const mode of ["realistic", "white", "install"]) {
      expect(sightLineLayers(mode)).toEqual(
        expect.arrayContaining(["kitchen-shell", "cabinet-layer", "fixture-layer"]),
      );
    }
  });
});

/**
 * And the machine being looked at is never faded off its own sight line, which
 * is decided by walking up from the mesh to whatever records a slot.
 */
describe("which machine a mesh belongs to", () => {
  const applianceTree = (slotId: string) => {
    const group = new THREE.Group();
    group.name = "appliance-" + slotId;
    group.userData = { slot: slotId };
    const body = new THREE.Group();
    body.userData = { cabinetRole: false };
    const mesh = new THREE.Mesh();
    body.add(mesh);
    group.add(body);
    return mesh;
  };

  it("finds the slot from a mesh two groups down, as an appliance is built", () => {
    expect(owningSlot(applianceTree("slot-hood"))).toBe("slot-hood");
  });

  it("tells one machine from another, so only its own is spared", () => {
    expect(owningSlot(applianceTree("slot-microwave"))).not.toBe("slot-hood");
  });

  it("says nothing for a mesh that belongs to no machine", () => {
    const loose = new THREE.Mesh();
    new THREE.Group().add(loose);
    expect(owningSlot(loose)).toBeUndefined();
  });
});

/**
 * And a machine is in the way only when it stands clear in front of the one
 * being looked at. Two columns in a bank are in the same plane, and a ray aimed
 * across the face of one grazes the other: fading it turns a bank of columns
 * into a bank with one of them made of glass.
 */
describe("what counts as being in the way", () => {
  // A column is about 25 inches deep; "out" is measured out of the selected
  // machine's own face, in feet.
  const columnDepth = 25 / 12;

  it("takes any joinery the ray meets, which is what the fade was written for", () => {
    expect(blocksSightLine(false, 0, columnDepth)).toBe(true);
    expect(blocksSightLine(false, 3, columnDepth)).toBe(true);
  });

  it("spares a machine flush beside the one being looked at", () => {
    // Two columns in one bank face the same way from the same plane.
    expect(blocksSightLine(true, 0, columnDepth)).toBe(false);
  });

  it("spares one a little proud of it, which is a bank with a deeper machine in it", () => {
    expect(blocksSightLine(true, 1, columnDepth)).toBe(false);
  });

  it("still fades a hood hung five feet out in front of an oven", () => {
    expect(blocksSightLine(true, 5.7, columnDepth)).toBe(true);
  });

  it("is a fact about the room, not about the camera", () => {
    // The first draft measured along the ray, and at a 45-degree isometric a
    // column two feet to one side is already a foot and a half nearer the
    // camera — which is why package D's freezer went to glass. Nothing here
    // takes a distance along a view axis.
    expect(blocksSightLine(true, 0, columnDepth)).toBe(false);
    expect(blocksSightLine(true, columnDepth, columnDepth)).toBe(false);
  });

  it("knows a machine's mesh from a cabinet's", () => {
    const applianceMesh = new THREE.Mesh();
    const group = new THREE.Group();
    group.userData = { slot: "slot-hood", appliance: true };
    group.add(applianceMesh);
    expect(isAppliance(applianceMesh)).toBe(true);

    const doorMesh = new THREE.Mesh();
    const cabinet = new THREE.Group();
    // A cabinet box records the slot it houses, and is still not a machine.
    cabinet.userData = { slot: "slot-hood" };
    cabinet.add(doorMesh);
    expect(isAppliance(doorMesh)).toBe(false);
  });
});
