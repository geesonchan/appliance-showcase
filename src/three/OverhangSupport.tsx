import { useMemo } from "react";
import * as THREE from "three";
import { overhangSupportZone } from "../data/overhang";
import { ISLAND, ft } from "../data/room";
import { useAppStore } from "../store/useAppStore";
import { UNCONFIRMED } from "./materials";

/**
 * Where the seating overhang has to be carried. Round 68, D20.
 *
 * The support is concealed steel plate (Leo's site practice), so the finished
 * room shows nothing — that is what it looks like. The install view draws the
 * part of the top that needs carrying, dashed grey: D21's reviewed-but-not-a-
 * drawing tier, because the 10"-12" it rests on is trade experience and the
 * plate is site practice. The plates themselves are not drawn: how many, how
 * wide and how far back under the cabinets they run has no source here.
 *
 * Mounted inside the room's key, so it is rebuilt with the island. It takes no
 * clicks: it is a mark, not a part.
 */
export function OverhangSupport() {
  const renderMode = useAppStore((s) => s.renderMode);
  const zone = useMemo(() => overhangSupportZone(ISLAND), []);

  const line = useMemo(() => {
    if (!zone) return null;
    // A hair under the stone, so the dashes are not lost in its underside.
    const points = [...zone.corners, zone.corners[0]].map(
      ([x, y, z]) => new THREE.Vector3(x, y - ft(0.25), z),
    );
    const drawn = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({ color: UNCONFIRMED, dashSize: ft(1.5), gapSize: ft(1) }),
    );
    drawn.computeLineDistances();
    drawn.userData = { tier: "unconfirmed" };
    drawn.raycast = () => null;
    return drawn;
  }, [zone]);

  if (!line) return null;
  return <primitive object={line} visible={renderMode === "install"} />;
}
