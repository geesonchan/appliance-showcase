import { Scene } from "./three/Scene";
import { DebugOverlay } from "./ui/DebugOverlay";
import { HelpDialog } from "./ui/HelpDialog";
import { LeftPanel } from "./ui/LeftPanel";
import { MobileSheet } from "./ui/MobileSheet";
import { DimensionOverlay } from "./ui/DimensionOverlay";
import { ModuleLabels } from "./ui/ModuleLabels";
import { PinOverlay } from "./ui/PinOverlay";
import { QuotePage } from "./ui/QuotePage";
import { RightPanel } from "./ui/RightPanel";
import { BottomBar, ModeSwitch, SelectionCallout, Toast } from "./ui/SceneControls";
import { SpecCard } from "./ui/SpecCard";
import { RailToggle } from "./ui/RailToggle";
import { TopBar } from "./ui/TopBar";
import { useT } from "./i18n/useT";
import { useAppStore } from "./store/useAppStore";

/**
 * The room gets the screen.
 *
 * At desktop widths the configuration rail starts closed and the appliance list
 * folds away, so the scene holds better than 80% of the viewport in the state
 * the app opens in. Both columns are still one click away; neither is where the
 * explaining happens. See docs/decisions.md D12.
 */
export default function App() {
  const t = useT();
  const leftOpen = useAppStore((s) => s.leftOpen);
  const rightOpen = useAppStore((s) => s.rightOpen);
  const toggleLeft = useAppStore((s) => s.toggleLeft);
  const toggleRight = useAppStore((s) => s.toggleRight);

  const columns = [
    leftOpen ? "minmax(200px,15%)" : "36px",
    "1fr",
    rightOpen ? "minmax(240px,18%)" : "36px",
  ].join(" ");

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar />

      <div
        className="grid min-h-0 flex-1 md:[grid-template-columns:var(--cols)]"
        style={{ ["--cols" as string]: columns }}
      >
        <aside className="hidden min-h-0 border-r border-line bg-surface md:flex md:flex-col">
          {leftOpen ? (
            <>
              <div className="min-h-0 flex-1">
                <LeftPanel />
              </div>
              <RailToggle
                side="left"
                open
                label={t("panel.collapseList")}
                onClick={toggleLeft}
              />
            </>
          ) : (
            <RailToggle
              side="left"
              open={false}
              label={t("list.title")}
              onClick={toggleLeft}
            />
          )}
        </aside>

        <main className="relative min-h-0">
          <Scene />
          <PinOverlay />
          <DimensionOverlay />
          <ModuleLabels />
          <ModeSwitch />
          <SelectionCallout />
          <BottomBar />
          <Toast />
          <MobileSheet />
          <DebugOverlay />
        </main>

        <aside className="hidden min-h-0 border-l border-line bg-surface md:flex md:flex-col">
          {rightOpen ? (
            <>
              <div className="min-h-0 flex-1">
                <RightPanel />
              </div>
              <RailToggle
                side="right"
                open
                label={t("panel.collapseConfig")}
                onClick={toggleRight}
              />
            </>
          ) : (
            <RailToggle
              side="right"
              open={false}
              label={t("panel.title")}
              onClick={toggleRight}
            />
          )}
        </aside>
      </div>

      <HelpDialog />
      <QuotePage />
      <SpecCard />
    </div>
  );
}
