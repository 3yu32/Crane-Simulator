/**
 * App shell: the 3D scene fills the screen; UI overlays sit on top (spec §25).
 */

import { useState } from "react";
import { CompactToolbar, type CompactPanel } from "./components/CompactToolbar";
import { GameScene } from "./components/GameScene";
import { CraneControls } from "./components/Controls/CraneControls";
import { ArmControls } from "./components/Controls/ArmControls";
import { PrizeControls } from "./components/Controls/PrizeControls";
import { BridgeControls } from "./components/Controls/BridgeControls";
import { PresetControls } from "./components/Controls/PresetControls";
import { DebugPanel } from "./components/Debug/DebugPanel";
import { toggleSideView, useGameState } from "./game/gameStore";
import "./App.css";

function PrizeGetBanner() {
  const prizeGet = useGameState((s) => s.prizeGet);
  if (!prizeGet) return null;
  return (
    <div className="prize-get">
      <span>PRIZE GET!</span>
    </div>
  );
}

/**
 * Clickable frame over the inset view the WebGL canvas renders here (its
 * position must match SIDE_VIEW_RECT in components/SideView.tsx). Clicking it
 * swaps the inset with the full-screen view.
 */
function InsetFrame() {
  const swapped = useGameState((s) => s.sideViewSwapped);
  return (
    <button
      type="button"
      className="side-view-frame"
      onClick={() => toggleSideView()}
      title="クリックでメイン画面と入れ替え"
    >
      <span>{swapped ? "MAIN ⤢" : "SIDE ⤢"}</span>
    </button>
  );
}

export default function App() {
  // Small screens show one settings panel at a time (see CompactToolbar);
  // on large screens CSS ignores this and keeps every panel visible.
  const [panel, setPanel] = useState<CompactPanel | null>(null);

  return (
    <div className="app" data-panel={panel ?? ""}>
      <div className="scene">
        <GameScene />
      </div>

      <header className="title">3D CRANE GAME</header>
      <CompactToolbar panel={panel} onChange={setPanel} />
      <PrizeGetBanner />
      <div className="left-stack">
        <ArmControls />
        <InsetFrame />
        <PrizeControls />
      </div>
      <BridgeControls />
      <PresetControls />
      <CraneControls />
      <DebugPanel />
    </div>
  );
}
