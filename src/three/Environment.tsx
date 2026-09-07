import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useAppStore } from "../store/useAppStore";

/**
 * What the metal in the room is reflecting.
 *
 * A stainless door lit by nothing but lamps is a flat grey rectangle: steel
 * reads as steel because it reflects a room. This builds one — three's own
 * `RoomEnvironment`, a box with light panels in it — filters it through the
 * PMREM generator and hands the result to the scene as its environment map.
 *
 * Generated rather than downloaded. A Poly Haven HDRI would be a megabyte of
 * binary in a repository that has none, for a reflection this scene shows in
 * glancing highlights on four appliances and a countertop; the built-in room is
 * the same idea at no download. `docs/reference/assets.md` records the choice
 * and what swapping in a real capture would take.
 *
 * The white model and the install view get none of it: they are drawn without
 * materials on purpose, and an environment map would put highlights back.
 */
export function Environment() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const renderMode = useAppStore((s) => s.renderMode);
  const lighting = useAppStore((s) => s.lighting);

  useEffect(() => {
    if (renderMode !== "realistic") {
      scene.environment = null;
      return;
    }

    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    // After dark the room reflects less of itself, not nothing: a kitchen at
    // night still has steel catching the under-cabinet lights.
    scene.environmentIntensity = lighting === "day" ? 1 : 0.35;

    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [scene, gl, renderMode, lighting]);

  return null;
}
