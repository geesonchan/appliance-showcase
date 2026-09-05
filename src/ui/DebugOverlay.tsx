import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

/** Enabled with `?debug=1`. Read once; toggling it means a reload. */
const enabled =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "1";

/** Rolling frame rate over roughly the last half second. */
function useFps() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();

    const tick = () => {
      frames += 1;
      const now = performance.now();
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        setFps(Math.round((frames / elapsed) * 1000));
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return fps;
}

/**
 * Times a render-mode switch from the click to the first frame painted in the
 * new mode. Two frames of latency: the first callback lands after React has
 * committed, the second after that frame has been drawn.
 */
function useModeSwitchTiming() {
  const renderMode = useAppStore((s) => s.renderMode);
  const startedAt = useAppStore((s) => s.modeSwitchStartedAt);
  const reportModeSwitch = useAppStore((s) => s.reportModeSwitch);
  const modeSwitchMs = useAppStore((s) => s.modeSwitchMs);

  useEffect(() => {
    if (startedAt === null) return;
    // A backgrounded tab throttles rAF to about 1Hz, which would report
    // seconds rather than the real paint cost.
    if (document.visibilityState !== "visible") return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => reportModeSwitch(performance.now() - startedAt));
    });
    return () => cancelAnimationFrame(raf);
    // renderMode is in the deps so a switch always restarts the measurement.
  }, [renderMode, startedAt, reportModeSwitch]);

  return modeSwitchMs;
}

function DebugPanel() {
  const fps = useFps();
  const modeSwitchMs = useModeSwitchTiming();

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-50 rounded border border-line bg-[rgba(31,42,34,0.88)] px-2.5 py-1.5 font-mono text-[10px] leading-[1.5] text-[#F7F5EF]">
      <div>
        <span className="tabular-nums">{String(fps).padStart(2, "0")}</span> fps
      </div>
      <div>
        mode switch{" "}
        <span className="tabular-nums">
          {modeSwitchMs === null ? "—" : `${modeSwitchMs} ms`}
        </span>
      </div>
    </div>
  );
}

/** Diagnostics overlay, rendered only when the page is loaded with `?debug=1`. */
export function DebugOverlay() {
  if (!enabled) return null;
  return <DebugPanel />;
}
