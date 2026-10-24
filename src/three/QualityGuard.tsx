import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { QUALITY_LOCKED, useAppStore } from "../store/useAppStore";
import { createJudge, watchScene } from "./qualityRule";
import { disposeTextures } from "./textures";

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
 * So are the two seconds after the scene is rebuilt or made heavier (round
 * 100, Leo): the rule, and what counts, are `qualityRule.ts`.
 */
export function QualityGuard() {
  const gl = useThree((s) => s.gl);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const reportFps = useAppStore((s) => s.reportFps);

  const frames = useRef(0);
  const since = useRef(0);
  const settled = useRef(false);
  const judge = useRef(createJudge(() => performance.now()));

  useEffect(() => watchScene(useAppStore, judge.current.changed), []);

  useFrame((_, delta) => {
    frames.current += 1;
    since.current += delta;
    if (since.current < 1) return;

    const fps = Math.round(frames.current / since.current);
    const startedAt = performance.now() - since.current * 1000;
    frames.current = 0;
    since.current = 0;
    reportFps(fps);

    if (!settled.current) {
      // One second of warm-up, then start judging.
      settled.current = true;
      return;
    }
    // Already low, or held where it is for a pixel proof (`QUALITY_LOCKED`).
    if (quality === "low" || QUALITY_LOCKED) return;
    const visible = document.visibilityState === "visible";
    if (!judge.current.second({ fps, startedAt, visible })) return;

    // Half-size maps and fewer pixels to fill: the two things that actually
    // cost, on the phones that cannot hold sixty.
    disposeTextures();
    gl.setPixelRatio(Math.min(gl.getPixelRatio(), 1.25));
    setQuality("low");
  });

  return null;
}
