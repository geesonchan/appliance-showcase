import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SLOT_BY_ID, ft } from "../data/slots";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAppStore } from "../store/useAppStore";

/** Isometric default: ~35 degrees elevation, ~45 degrees azimuth, per §10. */
const ELEVATION = THREE.MathUtils.degToRad(35);
const AZIMUTH = THREE.MathUtils.degToRad(45);
/** Centre of the room's bounding box, which is what the default view frames. */
const DEFAULT_TARGET = new THREE.Vector3(0, 4.5, 0);
const DEFAULT_DISTANCE = 22;
/**
 * How much of the world the default view keeps in frame, in feet. The 14' x 12'
 * room projects to roughly 18.4ft across and 17.9ft tall at this camera angle;
 * the extra allowance is margin for the floating mode switch and toolbar.
 */
const FIT_FEET = { w: 19.6, h: 19.4 };
/**
 * Portrait viewports are width-starved. Framing a little tighter there crops
 * only the empty floor corners and roughly doubles the usable scene area.
 */
const FIT_FEET_PORTRAIT_W = 16.5;

/**
 * Framing offset applied while the mobile sheet is open, as a fraction of the
 * viewport height. Negative moves the camera down its own up axis, which lifts
 * the room into the half of the screen the sheet does not cover.
 *
 * This is one of exactly two behaviours allowed to move the camera on their
 * own; see docs/decisions.md.
 */
const SHEET_FRAMING_OFFSET = -0.12;
const SHEET_OFFSET_MS = 300;
const FLY_MS = 800;

const isoOffset = (distance: number, azimuth = AZIMUTH) =>
  new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(azimuth),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(azimuth),
  ).multiplyScalar(distance);

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
export function CameraRig() {
  const controlsRef = useRef<OrbitControls | null>(null);
  const tween = useRef<Tween | null>(null);
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

  // Keep the whole room framed at any canvas size rather than cropping.
  const fitWidth = size.width < size.height ? FIT_FEET_PORTRAIT_W : FIT_FEET.w;
  const fitZoom = Math.min(size.width / fitWidth, size.height / FIT_FEET.h);

  const startTween = (
    target: THREE.Vector3,
    distance: number,
    zoom: number,
    duration = FLY_MS,
    azimuth = AZIMUTH,
  ) => {
    const controls = controlsRef.current;
    if (!controls) return;
    tween.current = {
      fromTarget: controls.target.clone(),
      // Absolute destinations are computed in unshifted space, so the framing
      // offset currently in effect has to be carried across.
      toTarget: target.clone().add(appliedOffset.current),
      fromPos: camera.position.clone(),
      toPos: target.clone().add(isoOffset(distance, azimuth)).add(appliedOffset.current),
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
  const pose = useRef({
    target: DEFAULT_TARGET.clone(),
    position: DEFAULT_TARGET.clone().add(isoOffset(DEFAULT_DISTANCE)),
    zoom: 0,
  });

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
    target.x += Math.sin(slot.rotationY) * 1.6;
    target.z += Math.cos(slot.rotationY) * 1.6;
    // The island openings face away from the default view, so orbit round to
    // them rather than flying in on their backs. See docs/decisions.md D1.
    startTween(target, 11, fitZoom * 1.7, FLY_MS, slot.viewAzimuth ?? AZIMUTH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot]);

  useEffect(() => {
    if (resetToken === 0) return;
    startTween(DEFAULT_TARGET, DEFAULT_DISTANCE, fitZoom, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  // The +/- buttons step the orthographic zoom without moving the camera.
  useEffect(() => {
    const controls = controlsRef.current;
    if (zoomRequest.token === 0 || !controls) return;
    const factor = zoomRequest.direction === 1 ? 1.3 : 1 / 1.3;
    const next = THREE.MathUtils.clamp(camera.zoom * factor, fitZoom * 0.45, fitZoom * 6);
    const distance = camera.position.distanceTo(controls.target);
    startTween(controls.target.clone(), distance, next, 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest.token]);

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

  useFrame(() => {
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
