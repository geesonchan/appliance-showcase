import { Scene } from "./three/Scene";
import { DebugOverlay } from "./ui/DebugOverlay";
import { HelpDialog } from "./ui/HelpDialog";
import { LeftPanel } from "./ui/LeftPanel";
import { MobileSheet } from "./ui/MobileSheet";
import { DimensionOverlay } from "./ui/DimensionOverlay";
import { LayoutIssues } from "./ui/LayoutIssues";
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

/** The appliance list's width when open. Fixed, so a long model name truncates. */
const LIST_RAIL_PX = 260;

/**
 * The room gets the screen.
 *
 * At desktop widths the page opens with Configuration open and the appliance
 * list folded to its rail, and a tab remembers either being changed. The list
 * is a fixed width, so what is in it has to fit rather than push the column
 * wider. See docs/decisions.md D12.
 */
export default function App() {
  const t = useT();
  const leftOpen = useAppStore((s) => s.leftOpen);
  const rightOpen = useAppStore((s) => s.rightOpen);
  const toggleLeft = useAppStore((s) => s.toggleLeft);
  const toggleRight = useAppStore((s) => s.toggleRight);
  /**
   * The parts of the interface that are drawings of the room rather than
   * controls over it. Rebuilding the layout replaces the module values they
   * read, so they are keyed on the version and remount when it moves; the
   * right rail is deliberately not, because remounting it mid-drag would take
   * the slider out from under the pointer.
   */
  const layoutVersion = useAppStore((s) => s.layoutVersion);

  const columns = [
    leftOpen ? `${LIST_RAIL_PX}px` : "36px",
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
        <aside className="hidden min-h-0 min-w-0 border-r border-line bg-surface md:flex md:flex-col">
          {leftOpen ? (
            <>
              <div className="min-h-0 flex-1">
                <LeftPanel key={layoutVersion} />
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

        {/* min-w-0: without it the middle track cannot shrink below the
            canvas it is already showing, and opening a rail pushes the page
            wider instead of narrowing the scene. */}
        <main className="relative min-h-0 min-w-0">
          <Scene />
          {/* The vignette, as an overlay rather than a shader pass. A post
              stack would cost the MSAA the scene is antialiased with, for a
              darkening the browser composites for free. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 62%, rgba(24,26,22,0.10) 100%)",
            }}
          />
          <PinOverlay key={`pins-${layoutVersion}`} />
          <DimensionOverlay key={`dims-${layoutVersion}`} />
          <LayoutIssues />
          <ModuleLabels key={`modules-${layoutVersion}`} />
          <ModeSwitch />
          <SelectionCallout />
          <BottomBar />
          <Toast />
          <MobileSheet />
          <DebugOverlay />
        </main>

        <aside className="hidden min-h-0 min-w-0 border-l border-line bg-surface md:flex md:flex-col">
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
      <SpecCard key={layoutVersion} />
    </div>
  );
}
