import { CABINETS } from "../data/cabinets";
import { SLOT_ORDER } from "../data/catalogue";
import { ROOM, SLOT_BY_ID, ft, isOmitted } from "../data/slots";
import { useAppStore } from "../store/useAppStore";

const PAD = 0.6;

/**
 * A small top-down key showing where each appliance sits. Not the full plan
 * view from the reference product's bottom toolbar, which is a later
 * milestone; this is the right-hand panel's thumbnail.
 */
export function PlanThumbnail() {
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const selectSlot = useAppStore((s) => s.selectSlot);

  // Read per render rather than once at import: the wall lengths are
  // parameters now, and this component is remounted when they change.
  const W = ROOM.halfX * 2;
  const D = ROOM.halfZ * 2;
  /** World x/z to SVG coordinates. */
  const sx = (x: number) => x + ROOM.halfX + PAD;
  const sz = (z: number) => z + ROOM.halfZ + PAD;

  return (
    <svg
      viewBox={`0 0 ${W + PAD * 2} ${D + PAD * 2}`}
      className="w-full rounded-sm border border-line bg-[var(--bg)]"
      role="img"
      aria-label="Kitchen floor plan"
    >
      {/* room outline; the two solid edges are the walls the run sits against */}
      <rect
        x={PAD}
        y={PAD}
        width={W}
        height={D}
        fill="none"
        stroke="var(--line)"
        strokeWidth={0.08}
        strokeDasharray="0.4 0.3"
      />
      <path
        d={`M ${PAD} ${PAD + D} L ${PAD} ${PAD} L ${PAD + W} ${PAD}`}
        fill="none"
        stroke="var(--ink-muted)"
        strokeWidth={0.16}
      />

      {CABINETS.filter((box) => box.kind === "base" || box.kind === "tall").map((box) => (
        <rect
          key={box.id}
          x={sx(box.position[0] - box.size[0] / 2)}
          y={sz(box.position[2] - box.size[2] / 2)}
          width={box.size[0]}
          height={box.size[2]}
          fill="var(--line)"
          opacity={0.55}
        />
      ))}

      {SLOT_ORDER.map((slotId, index) => {
        const slot = SLOT_BY_ID[slotId];
        // The hood sits above the range; in plan it would just cover it. A
        // machine the room was built without is not on the plan at all.
        if (slotId === "slot-hood" || isOmitted(slotId)) return null;
        const alongZ = Math.abs(slot.rotationY) > 0.01;
        const w = ft(alongZ ? slot.cutout.d : slot.cutout.w);
        const h = ft(alongZ ? slot.cutout.w : slot.cutout.d);
        const selected = selectedSlot === slotId;
        return (
          <g
            key={slotId}
            onClick={() => selectSlot(selected ? null : slotId)}
            className="cursor-pointer"
          >
            <rect
              x={sx(slot.position[0] - w / 2)}
              y={sz(slot.position[2] - h / 2)}
              width={w}
              height={h}
              fill={selected ? "var(--accent)" : "var(--wood)"}
              stroke="var(--ink)"
              strokeWidth={0.05}
            />
            <text
              x={sx(slot.position[0])}
              y={sz(slot.position[2]) + 0.28}
              textAnchor="middle"
              fontSize={0.75}
              fill={selected ? "var(--surface)" : "var(--ink)"}
            >
              {String(index + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
