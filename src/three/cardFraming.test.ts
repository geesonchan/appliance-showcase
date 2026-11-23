import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DEFAULT_TARGET, fitExtents, frameRoom, freePart, isoOffset, type ScreenBox } from "./cardFraming";
import { defaultView } from "../data/defaultView";

/**
 * The room framed in a part of the canvas (D1's sixth reason; item 12e-2, Leo,
 * 2026-11-20: 「换型号以后的镜头选 bingjia3」), by the one function the reset view
 * uses too (Leo: 「不能有第二份」).
 *
 * Every canvas and card here is lopsided — no square canvas, no card in the
 * middle — so a sign or an axis mixed up cannot pass by symmetry. The
 * prototype once had the shift's left and right the wrong way round; the
 * projection check below is what holds that.
 */

const rad = THREE.MathUtils.degToRad;
const L = { azimuth: rad(defaultView("L").azimuthDeg), pitch: rad(defaultView("L").pitchDeg) };
const U = { azimuth: rad(defaultView("U").azimuthDeg), pitch: rad(defaultView("U").pitchDeg) };

/** Where a world point lands on the canvas, in pixels from its top left, through a camera like the scene's. */
function onScreen(canvas: ScreenBox, zoom: number, target: THREE.Vector3, view: { azimuth: number; pitch: number }, point: THREE.Vector3) {
  // react-three-fiber's orthographic camera: one unit a pixel before the zoom.
  const camera = new THREE.OrthographicCamera(-canvas.width / 2, canvas.width / 2, canvas.height / 2, -canvas.height / 2, 0.1, 1000);
  camera.zoom = zoom;
  camera.position.copy(target).add(isoOffset(22, view.azimuth, view.pitch));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const v = point.clone().project(camera);
  return { x: ((v.x + 1) / 2) * canvas.width, y: ((1 - v.y) / 2) * canvas.height };
}

const centreOf = (box: ScreenBox, canvas: ScreenBox) => ({
  x: box.left - canvas.left + box.width / 2,
  y: box.top - canvas.top + box.height / 2,
});

describe("the part of the canvas the card leaves free", () => {
  const desk: ScreenBox = { left: 0, top: 0, width: 1440, height: 836 };
  const narrow: ScreenBox = { left: 0, top: 0, width: 767, height: 812 };

  it("on a desktop, right of the card at the scene's left", () => {
    expect(freePart(desk, { left: 16, top: 16, width: 260, height: 610 }, "left")).toEqual({
      left: 276,
      top: 0,
      width: 1164,
      height: 836,
    });
  });

  it("on a phone and up to 767 wide, above the card coming up from the bottom", () => {
    expect(freePart(narrow, { left: 0, top: 498, width: 767, height: 314 }, "bottom")).toEqual({
      left: 0,
      top: 0,
      width: 767,
      height: 498,
    });
  });

  it("with no card, or one over the whole canvas, the whole canvas: the reset view's", () => {
    expect(freePart(desk, null, "left")).toEqual(desk);
    expect(freePart(desk, { left: 0, top: 0, width: 0, height: 0 }, "left")).toEqual(desk);
    expect(freePart(narrow, { left: 0, top: -4, width: 767, height: 900 }, "bottom")).toEqual(narrow);
  });
});

describe("frameRoom: the zoom that fits the room in the part, the room's centre at the part's centre", () => {
  it("over the whole canvas it is the reset view: DEFAULT_TARGET and the zoom the canvas fits", () => {
    const whole: ScreenBox = { left: 0, top: 0, width: 1440, height: 836 };
    const fit = fitExtents(L.azimuth, L.pitch);
    const { zoom, target } = frameRoom(whole, whole, L.azimuth, L.pitch);
    expect(zoom).toBe(Math.min(1440 / fit.w, 836 / fit.h));
    expect(target.toArray()).toEqual(DEFAULT_TARGET.toArray());
  });

  it("the zoom is the part's width or height over the room's, whichever is less", () => {
    const canvas: ScreenBox = { left: 0, top: 0, width: 1440, height: 836 };
    const part: ScreenBox = { left: 276, top: 0, width: 1164, height: 836 };
    const fit = fitExtents(U.azimuth, U.pitch);
    expect(frameRoom(canvas, part, U.azimuth, U.pitch).zoom).toBe(Math.min(1164 / fit.w, 836 / fit.h));
  });

  const cases: { name: string; canvas: ScreenBox; part: ScreenBox; view: { azimuth: number; pitch: number } }[] = [
    {
      name: "a desktop, the L's angle, the card at the left",
      canvas: { left: 0, top: 0, width: 1440, height: 836 },
      part: { left: 276, top: 0, width: 1164, height: 836 },
      view: L,
    },
    {
      name: "a desktop, the U's angle, the card at the left",
      canvas: { left: 0, top: 0, width: 1440, height: 836 },
      part: { left: 276, top: 0, width: 1164, height: 836 },
      view: U,
    },
    {
      name: "767 wide, the L's angle, the card from the bottom",
      canvas: { left: 0, top: 0, width: 767, height: 812 },
      part: { left: 0, top: 0, width: 767, height: 498 },
      view: L,
    },
    {
      name: "a 390 phone, the U's angle, the card from the bottom, the canvas not at the page's top",
      canvas: { left: 0, top: 52, width: 390, height: 731 },
      part: { left: 0, top: 52, width: 390, height: 377 },
      view: U,
    },
  ];

  it.each(cases)("$name: the room's centre lands at the part's centre, to a thousandth of a pixel", ({ canvas, part, view }) => {
    const { zoom, target } = frameRoom(canvas, part, view.azimuth, view.pitch);
    const got = onScreen(canvas, zoom, target, view, DEFAULT_TARGET);
    const want = centreOf(part, canvas);
    expect({ x: +got.x.toFixed(3), y: +got.y.toFixed(3) }).toEqual({ x: +want.x.toFixed(3), y: +want.y.toFixed(3) });
  });

  it.each(cases)("$name: the room's own box, as the reset view frames it, stays inside the part", ({ canvas, part, view }) => {
    const { zoom, target } = frameRoom(canvas, part, view.azimuth, view.pitch);
    const fit = fitExtents(view.azimuth, view.pitch);
    // The framed extent, on the screen, is the fit times the zoom, centred on the part.
    const c = onScreen(canvas, zoom, target, view, DEFAULT_TARGET);
    const half = { w: (fit.w * zoom) / 2, h: (fit.h * zoom) / 2 };
    const p = { left: part.left - canvas.left, top: part.top - canvas.top };
    expect(c.x - half.w).toBeGreaterThanOrEqual(p.left - 1e-6);
    expect(c.x + half.w).toBeLessThanOrEqual(p.left + part.width + 1e-6);
    expect(c.y - half.h).toBeGreaterThanOrEqual(p.top - 1e-6);
    expect(c.y + half.h).toBeLessThanOrEqual(p.top + part.height + 1e-6);
  });
});
