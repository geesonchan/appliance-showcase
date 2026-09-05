import { useT } from "./i18n/useT";
import { useAppStore } from "./store/useAppStore";
import { Scene } from "./three/Scene";
import { HelpDialog } from "./ui/HelpDialog";
import { LeftPanel } from "./ui/LeftPanel";
import { PinOverlay } from "./ui/PinOverlay";
import { RightPanel } from "./ui/RightPanel";
import { BottomBar, ModeSwitch, SelectionCallout, Toast } from "./ui/SceneControls";
import { TopBar } from "./ui/TopBar";

/**
 * Below `md` the two side columns collapse into bottom drawers so the scene
 * keeps the whole viewport, as called for in §2.1.
 */
function MobileDrawers() {
  const t = useT();
  const panel = useAppStore((s) => s.mobilePanel);
  const setMobilePanel = useAppStore((s) => s.setMobilePanel);

  return (
    <div className="md:hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-[72px] z-30 flex justify-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setMobilePanel(panel === "list" ? "none" : "list")}
          className="pointer-events-auto rounded-full border border-line bg-surface px-4 py-2 text-[12px] font-medium text-ink"
        >
          {t("mobile.appliances")}
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel(panel === "config" ? "none" : "config")}
          className="pointer-events-auto rounded-full border border-line bg-surface px-4 py-2 text-[12px] font-medium text-ink"
        >
          {t("mobile.config")}
        </button>
      </div>

      {panel !== "none" && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-[rgba(31,42,34,0.3)]"
          onClick={() => setMobilePanel("none")}
        >
          <div
            className="max-h-[72vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2">
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            {panel === "list" ? <LeftPanel /> : <RightPanel />}
            <button
              type="button"
              onClick={() => setMobilePanel("none")}
              className="w-full border-t border-line py-3 text-[12px] text-ink-muted"
            >
              {t("mobile.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar />

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(262px,15%)_1fr_minmax(268px,20%)]">
        <aside className="hidden min-h-0 border-r border-line bg-surface md:block">
          <LeftPanel />
        </aside>

        <main className="relative min-h-0">
          <Scene />
          <PinOverlay />
          <ModeSwitch />
          <SelectionCallout />
          <BottomBar />
          <Toast />
          <MobileDrawers />
        </main>

        <aside className="hidden min-h-0 border-l border-line bg-surface md:block">
          <RightPanel />
        </aside>
      </div>

      <HelpDialog />
    </div>
  );
}
