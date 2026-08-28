/**
 * App shell: the 3D scene fills the screen; UI overlays sit on top (spec §25).
 */

import { GameScene } from "./components/GameScene";
import { CraneControls } from "./components/Controls/CraneControls";
import { ArmControls } from "./components/Controls/ArmControls";
import { PrizeControls } from "./components/Controls/PrizeControls";
import { DebugPanel } from "./components/Debug/DebugPanel";
import { useGameState } from "./game/gameStore";
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

export default function App() {
  return (
    <div className="app">
      <div className="scene">
        <GameScene />
      </div>

      <header className="title">3D CRANE GAME</header>
      <PrizeGetBanner />
      <ArmControls />
      <PrizeControls />
      {/* Frame/label over the side-view inset the WebGL canvas renders here
          (position must match SIDE_VIEW_RECT in components/SideView.tsx). */}
      <div className="side-view-frame">
        <span>SIDE</span>
      </div>
      <CraneControls />
      <DebugPanel />
    </div>
  );
}
