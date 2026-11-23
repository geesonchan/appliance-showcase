import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useSceneFrame } from "./useSceneFrame";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SLOT_BY_ID, ft } from "../data/slots";
import { outward } from "../data/frame";
import { flyInAzimuth } from "../data/flyIn";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAppStore } from "../store/useAppStore";
import { defaultView } from "../data/defaultView";
import { useSelection } from "../store/useSelection";
import type { LayoutShape } from "../data/layoutShape";
import { DEFAULT_TARGET, frameRoom, freePart, isoOffset as isoAt, type ScreenBox } from "./cardFraming";

/**
 * The default view for a shape, in radians: the L's and one wall's isometric
 * ~35 degrees elevation, ~45 degrees azimuth, per §10; the U's from straight
 * in front, 50 degrees down (Leo, 2026-11-12: 「U 的默认视角定：正前方，往下 50°」,
 * `defaultView`).
 */
const viewFor = (shape: LayoutShape) => {
  const { azimuthDeg, pitchDeg } = defaultView(shape);
  return { azimuth: THREE.MathUtils.degToRad(azimuthDeg), pitch: THREE.MathUtils.degToRad(pitchDeg) };
};
const ELEVATION = viewFor("L").pitch;
const AZIMUTH = viewFor("L").azimuth;
const DEFAULT_DISTANCE = 22;
/**
 * Framing offset applied while the mobile sheet is open, as a fraction of the
 * viewport height. Negative moves the camera down its own up axis, which lifts
 * the room into the half of the screen the sheet does not cover.
 *
 * This is one of the reasons D1 allows the camera to move on its own (its
 * second); see docs/decisions.md.
 */
const SHEET_FRAMING_OFFSET = -0.12;
const SHEET_OFFSET_MS = 300;
const FLY_MS = 800;
/**
 * How far a press may travel and still be a click, in whole pixels: the line
 * react-three-fiber draws, past which a press on the bare scene is no longer a
 * click and closes nothing (`delta <= 2` in its events). Past it, a press is a
 * drag.
 */
const CLICK_PX = 2;

/**
 * A camera offset at a given azimuth and pitch.
 *
 * Both default to the isometric view. Every slot declares its own in
 * `data/slots.json`, so a fly-in arrives at the angle the appliance is actually
 * read from rather than the angle the room happens to look good at.
 */
const isoOffset = (distance: number, azimuth = AZIMUTH, pitch = ELEVATION) => isoAt(distance, azimuth, pitch);

/** The whole canvas, as a box from its own top left: the reset view's part. */
const wholeOf = (size: { width: number; height: number }): ScreenBox => ({
  left: 0,
  top: 0,
  width: size.width,
  height: size.height,
});

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Tween {
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromZoom: number;
  toZoom: number;
  start: number;
  duration: number;
}

/**
 * Orbit, zoom, and the camera fly-in.
 *
 * Controls come straight from three's own examples rather than a wrapper, so
 * the only runtime dependency here is three itself.
 */
export function CameraRig({ atSwapView }: { atSwapView: MutableRefObject<boolean> }) {
  const controlsRef = useRef<OrbitControls | null>(null);
  const tween = useRef<Tween | null>(null);
  // `atSwapView`: whether the camera is still where a model swap put it (D1's
  // sixth reason; Leo, 2026-11-20: 「换型号以后我自己拖动、缩放、按重置或飞到别的机器，
  // 再关卡片：镜头不回」). Set by the swap; cleared when the camera has really been
  // moved by hand (`handMoving`, below), by a zoom button, Reset, a fly-in to
  // another machine, the card closed, and a room built again (a package, a
  // shape, an Undo, or anything on the Layout tab that builds the room: a wall
  // slider dragged, the island turned, added or sized, the oven tower's
  // height, any other choice there — none of which may move the camera by
  // closing the card on its way; `layoutVersion`, below). A swap that builds
  // the room again (a hood, a range for a rangetop, the oven tower's oven, the
  // refrigerator, where it changes the run) clears it and sets it again: the
  // swap's effect comes after the clear. Held by `Scene`, so the sight-line
  // fade asks it too: nothing is faded while it is set (`OcclusionFade`; Leo,
  // 2026-11-22), and after a room built again the fade is back where the
  // camera stands (Leo, 2026-11-22: 「换型号后拖墙或转岛台让淡化回来：选甲，照现在的做法，
  // 不改代码。这是我定的。」).
  /**
   * Whether the hand on the scene is moving the camera, not clicking it (Leo,
   * 2026-11-21: 「标记改成镜头真的动了才清」): a press that has travelled more than
   * CLICK_PX from where it went down, two fingers at once, or a wheel. Only
   * then does a change the controls report clear `atSwapView`. A press that
   * stays within a click — the one that closes the card from the bare scene —
   * leaves it set, even where its pixel or two has turned the camera a little.
   * Back to false at the next press and at a swap, so a drag before the swap,
   * still easing out, does not count against it.
   */
  const handMoving = useRef(false);
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const resetToken = useAppStore((s) => s.resetToken);
  const zoomRequest = useAppStore((s) => s.zoomRequest);
  const isMobile = useIsMobile();
  const sheetOpen = useAppStore((s) => s.mobilePanel !== "none") && isMobile;

  /** Framing offset currently baked into the camera pose, in world units. */
  const appliedOffset = useRef(new THREE.Vector3());
  /** Eased progress of the sheet offset, 0 to 1. */
  const offsetProgress = useRef(0);
  const offsetTween = useRef<{ from: number; to: number; start: number } | null>(null);
  const camUp = useMemo(() => new THREE.Vector3(), []);
  const desiredOffset = useMemo(() => new THREE.Vector3(), []);

  // Keep the whole room framed at any canvas size rather than cropping. The
  // room's own size is a parameter, so this is recomputed when it changes
  // rather than measured once at import.
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  // Framed from the shape's own default view (U-2).
  const shape = useAppStore((s) => s.layoutParams.shape);
  // The reset view's zoom: the room framed in the whole canvas (`frameRoom`,
  // the same as after a model swap with no card in the way).
  const fitZoom = useMemo(() => {
    const view = viewFor(shape);
    const whole = wholeOf(size);
    return frameRoom(whole, whole, view.azimuth, view.pitch).zoom;
  }, [layoutVersion, shape, size.width, size.height]);

  const startTween = (
    target: THREE.Vector3,
    distance: number,
    zoom: number,
    duration = FLY_MS,
    azimuth = AZIMUTH,
    pitch = ELEVATION,
  ) => {
    const controls = controlsRef.current;
    if (!controls) return;
    tween.current = {
      fromTarget: controls.target.clone(),
      // Absolute destinations are computed in unshifted space, so the framing
      // offset currently in effect has to be carried across.
      toTarget: target.clone().add(appliedOffset.current),
      fromPos: camera.position.clone(),
      toPos: target.clone().add(isoOffset(distance, azimuth, pitch)).add(appliedOffset.current),
      fromZoom: camera.zoom,
      toZoom: zoom,
      start: performance.now(),
      duration,
    };
  };

  /**
   * The camera pose, kept outside the controls instance. If the controls are
   * ever re-created (a renderer swap, a fast-refresh in dev), the view has to
   * come back exactly where it was rather than snapping to the default.
   */
  // The page opens on the default view of the shape it opens in: a link to a
  // U, from in front (U-2).
  const pose = useRef(
    (() => {
      const view = viewFor(useAppStore.getState().layoutParams.shape);
      return {
        target: DEFAULT_TARGET.clone(),
        position: DEFAULT_TARGET.clone().add(isoOffset(DEFAULT_DISTANCE, view.azimuth, view.pitch)),
        zoom: 0,
      };
    })(),
  );

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    // A user gesture always wins over a running fly-in.
    controls.addEventListener("start", () => {
      tween.current = null;
    });
    // The camera really moved by hand: no longer where a model swap put it,
    // so closing the card leaves it be (D1's sixth reason). The controls say
    // `change` only when the camera has moved; the hand says whether it was
    // a drag, a pinch or a wheel rather than a click.
    controls.addEventListener("change", () => {
      if (handMoving.current) atSwapView.current = false;
    });
    // Read before the controls' own listeners (capture), so a move is known
    // to be a drag by the time it turns the camera.
    const dom = gl.domElement;
    const downAt = new Map<number, { x: number; y: number }>();
    const onDown = (e: PointerEvent) => {
      if (downAt.size === 0) handMoving.current = false;
      downAt.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (downAt.size > 1) handMoving.current = true;
    };
    const onMove = (e: PointerEvent) => {
      const at = downAt.get(e.pointerId);
      if (at && Math.round(Math.hypot(e.clientX - at.x, e.clientY - at.y)) > CLICK_PX) handMoving.current = true;
    };
    const onUp = (e: PointerEvent) => {
      downAt.delete(e.pointerId);
    };
    const onWheel = () => {
      handMoving.current = true;
    };
    const capture = { capture: true } as const;
    dom.addEventListener("pointerdown", onDown, capture);
    dom.addEventListener("pointermove", onMove, capture);
    dom.addEventListener("pointerup", onUp, capture);
    dom.addEventListener("pointercancel", onUp, capture);
    dom.addEventListener("wheel", onWheel, { capture: true, passive: true });

    controls.target.copy(pose.current.target);
    camera.position.copy(pose.current.position);
    if (pose.current.zoom > 0) camera.zoom = pose.current.zoom;
    camera.updateProjectionMatrix();
    controls.update();
    controlsRef.current = controls;

    return () => {
      // Store the pose without the framing offset; the frame loop re-applies
      // it, and keeping it here would double it on the next mount.
      pose.current = {
        target: controls.target.clone().sub(appliedOffset.current),
        position: camera.position.clone().sub(appliedOffset.current),
        zoom: camera.zoom,
      };
      appliedOffset.current.set(0, 0, 0);
      dom.removeEventListener("pointerdown", onDown, capture);
      dom.removeEventListener("pointermove", onMove, capture);
      dom.removeEventListener("pointerup", onUp, capture);
      dom.removeEventListener("pointercancel", onUp, capture);
      dom.removeEventListener("wheel", onWheel, capture);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  // Zoom limits and framing follow the canvas size.
  const prevFit = useRef<number | null>(null);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.minZoom = fitZoom * 0.45;
    controls.maxZoom = fitZoom * 6;
    if (prevFit.current === null) {
      camera.zoom = fitZoom;
    } else if (!tween.current) {
      // Preserve however far the user has zoomed in across a resize.
      camera.zoom *= fitZoom / prevFit.current;
    }
    prevFit.current = fitZoom;
    camera.updateProjectionMatrix();
  }, [fitZoom, camera]);

  // Fly to the selected appliance.
  useEffect(() => {
    if (!selectedSlot) return;
    const slot = SLOT_BY_ID[selectedSlot];
    const target = new THREE.Vector3(
      slot.position[0],
      slot.position[1] + ft(slot.cutout.h) / 2,
      slot.position[2],
    );
    // Pull the focus point out in front of the appliance so it sits centre-frame.
    const [outX, outZ] = outward(slot.rotationY);
    target.x += outX * 1.6;
    target.z += outZ * 1.6;
    // Straight to the angle the slot declares, off the machine's own front and
    // turned with it (`flyInAzimuth`, D22). See docs/decisions.md D1.
    startTween(
      target,
      11,
      fitZoom * 1.7,
      FLY_MS,
      flyInAzimuth(slot),
      THREE.MathUtils.degToRad(slot.bestView.pitch),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot]);

  /**
   * Back to the default view of the shape on screen (U-2): the room framed in
   * the whole canvas. The reset button, and closing the card just after a
   * model swap (D1's sixth reason).
   */
  const toResetView = () => {
    const view = viewFor(useAppStore.getState().layoutParams.shape);
    const whole = wholeOf(size);
    const { zoom, target } = frameRoom(whole, whole, view.azimuth, view.pitch);
    startTween(target, DEFAULT_DISTANCE, zoom, 600, view.azimuth, view.pitch);
  };

  // Cleared first, before the effects below read it: these run in the order
  // they are written.
  useEffect(() => {
    atSwapView.current = false;
  }, [layoutVersion, resetToken, zoomRequest.token]);

  useEffect(() => {
    if (resetToken === 0) return;
    toResetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  // The card closed, with the camera still where a swap put it: back to the
  // reset view. Another machine picked instead is a fly-in (above).
  const lastSlot = useRef(selectedSlot);
  useEffect(() => {
    const before = lastSlot.current;
    lastSlot.current = selectedSlot;
    if (before === selectedSlot) return;
    const back = atSwapView.current && before !== null && selectedSlot === null;
    atSwapView.current = false;
    if (back) toResetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot]);

  /**
   * Where the camera is looking from now: its distance from the target and
   * its angle, in the terms `startTween` takes, and the target without the
   * framing offset (`startTween` adds it back).
   */
  const lookingFrom = (controls: OrbitControls) => {
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length();
    return {
      target: controls.target.clone().sub(appliedOffset.current),
      distance,
      azimuth: Math.atan2(offset.x, offset.z),
      pitch: Math.asin(offset.y / distance),
    };
  };

  // The +/- buttons step the orthographic zoom without moving the camera: at
  // the angle it is at (Leo, 2026-11-12: 「缩放时保持当前的角度」). Until then the
  // step left the angle to the tween's default, the L's 45°/35°, which turned a
  // fly-in or a U's own view round to it.
  useEffect(() => {
    const controls = controlsRef.current;
    if (zoomRequest.token === 0 || !controls) return;
    const factor = zoomRequest.direction === 1 ? 1.3 : 1 / 1.3;
    const next = THREE.MathUtils.clamp(camera.zoom * factor, fitZoom * 0.45, fitZoom * 6);
    const from = lookingFrom(controls);
    startTween(from.target, from.distance, next, 260, from.azimuth, from.pitch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest.token]);

  // Another model chosen for the machine on screen turns the camera to the
  // shape's default angle and frames the whole room in the part of the scene
  // the card leaves free, the card left open (D1's sixth reason, replacing the
  // fifth's 「角度和中心不动」; item 12e-2, Leo, 2026-11-20: 「换型号以后的镜头选
  // bingjia3」). Here only: whatever changes the model — the card, the list, an
  // Undo while it is open — comes through the selection. Closing the card
  // afterwards takes the camera to the reset view, if nothing has moved it
  // since (`atSwapView`).
  const selection = useSelection();
  const shownModel = selectedSlot ? selection[selectedSlot]?.id : undefined;
  const lastShown = useRef<{ slot: string | null; model: string | undefined }>({ slot: null, model: undefined });
  useEffect(() => {
    const last = lastShown.current;
    lastShown.current = { slot: selectedSlot, model: shownModel };
    const controls = controlsRef.current;
    if (!controls || !selectedSlot || last.slot !== selectedSlot || !last.model || last.model === shownModel) return;
    const view = viewFor(useAppStore.getState().layoutParams.shape);
    // The card's box as it stands now, in the canvas's own pixels.
    const canvasBox = gl.domElement.getBoundingClientRect();
    const cardBox = document.querySelector("[data-model-card]")?.getBoundingClientRect();
    const card: ScreenBox | null = cardBox
      ? { left: cardBox.left - canvasBox.left, top: cardBox.top - canvasBox.top, width: cardBox.width, height: cardBox.height }
      : null;
    const whole = wholeOf(size);
    const { zoom, target } = frameRoom(whole, freePart(whole, card, isMobile ? "bottom" : "left"), view.azimuth, view.pitch);
    startTween(target, DEFAULT_DISTANCE, zoom, 700, view.azimuth, view.pitch);
    atSwapView.current = true;
    handMoving.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot, shownModel]);

  // Ease the framing offset in and out whenever the sheet opens or closes.
  useEffect(() => {
    const to = sheetOpen ? 1 : 0;
    if (offsetProgress.current === to && !offsetTween.current) return;
    offsetTween.current = {
      from: offsetProgress.current,
      to,
      start: performance.now(),
    };
  }, [sheetOpen]);

  useSceneFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const active = tween.current;
    if (active) {
      const raw = (performance.now() - active.start) / active.duration;
      const t = easeInOutCubic(Math.min(1, raw));
      controls.target.lerpVectors(active.fromTarget, active.toTarget, t);
      camera.position.lerpVectors(active.fromPos, active.toPos, t);
      camera.zoom = THREE.MathUtils.lerp(active.fromZoom, active.toZoom, t);
      camera.updateProjectionMatrix();
      if (raw >= 1) tween.current = null;
    }

    if (offsetTween.current) {
      const { from, to, start } = offsetTween.current;
      const raw = (performance.now() - start) / SHEET_OFFSET_MS;
      offsetProgress.current = THREE.MathUtils.lerp(from, to, easeInOutCubic(Math.min(1, raw)));
      if (raw >= 1) offsetTween.current = null;
    }

    // Re-derive the offset every frame: it is defined in screen space, so it
    // has to follow the camera orientation and the current zoom. Shifting the
    // target and the position by the same vector is a pure pan, which leaves
    // the orbit relationship — and so the controls' own state — untouched.
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const worldHeight = size.height / camera.zoom;
    desiredOffset
      .copy(camUp)
      .multiplyScalar(SHEET_FRAMING_OFFSET * offsetProgress.current * worldHeight);

    if (!desiredOffset.equals(appliedOffset.current)) {
      const delta = desiredOffset.clone().sub(appliedOffset.current);
      controls.target.add(delta);
      camera.position.add(delta);
      appliedOffset.current.copy(desiredOffset);
    }

    controls.update();
  });

  return null;
}
