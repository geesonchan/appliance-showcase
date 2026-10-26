import { useEffect, useState } from "react";
import { useFrame, type RenderCallback } from "@react-three/fiber";

/**
 * Every frame's work in the 3D scene, in one place (round 99d, Leo).
 *
 * @react-three/fiber calls each `useFrame` callback from its frame loop with
 * nothing to catch what one throws (`render$1`, events-776716bd.esm.js:
 * 1530-1543), so a failure there never reached a fence: round 99c's trial
 * stopped the picture on an empty canvas, the error thrown again every frame,
 * with no message. Here a frame's failure is caught and handed to
 * `FrameFailureRelay`, which throws it again while the scene draws — where
 * fiber's own boundary takes it out of the canvas to the scene's fence (round
 * 99c), and the message and Retry show. `sceneFrame.test.ts` holds that
 * nothing else takes `useFrame` from fiber.
 */

let report: ((error: unknown) => void) | null = null;

export function useSceneFrame(callback: RenderCallback, priority?: number) {
  useFrame((state, delta, frame) => {
    try {
      callback(state, delta, frame);
    } catch (error) {
      // Before the relay is there — the first frames of a scene — as before.
      if (!report) throw error;
      report(error);
    }
  }, priority);
}

/** In the canvas: a frame's failure, thrown again while drawing, for the scene's fence to take. */
export function FrameFailureRelay(): null {
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  useEffect(() => {
    // The first failure only: the frames go on throwing until the fence takes the scene down.
    report = (error) => setFailure((now) => now ?? { error });
    return () => {
      report = null;
    };
  }, []);
  if (failure) throw failure.error;
  return null;
}
