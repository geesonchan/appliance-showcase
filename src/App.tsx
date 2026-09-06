import { Scene } from "./three/Scene";
import { DebugOverlay } from "./ui/DebugOverlay";
import { HelpDialog } from "./ui/HelpDialog";
import { LeftPanel } from "./ui/LeftPanel";
import { MobileSheet } from "./ui/MobileSheet";
import { PinOverlay } from "./ui/PinOverlay";
import { QuoteDialog } from "./ui/QuoteDialog";
import { SpecCard } from "./ui/SpecCard";
import { RightPanel } from "./ui/RightPanel";
import { BottomBar, ModeSwitch, SelectionCallout, Toast } from "./ui/SceneControls";
import { TopBar } from "./ui/TopBar";

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
          <MobileSheet />
          <DebugOverlay />
        </main>

        <aside className="hidden min-h-0 border-l border-line bg-surface md:block">
          <RightPanel />
        </aside>
      </div>

      <HelpDialog />
      <QuoteDialog />
      <SpecCard />
    </div>
  );
}
