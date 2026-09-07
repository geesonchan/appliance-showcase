import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAppStore } from "../store/useAppStore";
import { disposeTextures } from "./textures";

/** Below this, for this long, the room is not worth the pixels it costs. */
const FLOOR_FPS = 55;
const PATIENCE_MS = 2000;

/**
 * Watches the frame rate and gives up quality before the user gives up.
 *
 * Fifty-five is Leo's floor on a real phone. A room that drops under it gets
 * half-resolution textures and a coarser pixel ratio — once, and then it stops
 * measuring, because a guard that climbs back up the moment the camera stops
 * moving spends its life oscillating between two versions of the same room.
 *
 * The first second is ignored: shaders are still compiling then, and a scene
 * that stutters while it warms up is not a scene that is too heavy to draw.
 */
export function QualityGuard() {
  const gl = useThree((s) => s.gl);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const reportFps = useAppStore((s) => s.reportFps);

  const frames = useRef(0);
  const since = useRef(0);
  const slowFor = useRef(0);
  const settled = useRef(false);

  useFrame((_, delta) => {
    frames.current += 1;
    since.current += delta;
    if (since.current < 1) return;

    const fps = Math.round(frames.current / since.current);
    frames.current = 0;
    since.current = 0;
    reportFps(fps);

    if (!settled.current) {
      // One second of warm-up, then start judging.
      settled.current = true;
      return;
    }
    if (quality === "low") return;
    // A hidden tab is throttled to about 1Hz. Judging a room on that would
    // downgrade every scene anybody ever left in a background tab.
    if (document.visibilityState !== "visible") {
      slowFor.current = 0;
      return;
    }

    slowFor.current = fps < FLOOR_FPS ? slowFor.current + 1000 : 0;
    if (slowFor.current < PATIENCE_MS) return;

    // Half-size maps and fewer pixels to fill: the two things that actually
    // cost, on the phones that cannot hold sixty.
    disposeTextures();
    gl.setPixelRatio(Math.min(gl.getPixelRatio(), 1.25));
    setQuality("low");
  });

  return null;
}
