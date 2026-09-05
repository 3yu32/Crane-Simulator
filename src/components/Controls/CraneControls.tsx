/**
 * On-screen controls (spec §11, §25, §26): two hold-to-move buttons and RESET.
 * Pointer events are used so mouse and touch behave identically — press starts
 * movement, release stops it.
 */

import { useCallback, useEffect } from "react";
import { enabledButtons } from "../../game/craneStateMachine";
import { gameConfig } from "../../config/gameConfig";
import {
  goDirect,
  resetGame,
  setControlStyle,
  setDirectTarget,
  setInput,
  useGameState,
} from "../../game/gameStore";

/** Style toggle, always visible regardless of which style is active. */
function StyleToggle() {
  const controlStyle = useGameState((s) => s.controlStyle);
  return (
    <div className="style-toggle" role="group" aria-label="操作方法">
      <button
        type="button"
        className={controlStyle === "hold" ? "style-btn active" : "style-btn"}
        onClick={() => setControlStyle("hold")}
      >
        スタイル1
      </button>
      <button
        type="button"
        className={controlStyle === "direct" ? "style-btn active" : "style-btn"}
        onClick={() => setControlStyle("direct")}
      >
        スタイル2
      </button>
    </div>
  );
}

/** Style 1: hold 右/奥 to move one axis at a time. */
function HoldMoveControls() {
  const craneState = useGameState((s) => s.craneState);
  const { right: rightEnabled, back: backEnabled } = enabledButtons(craneState);

  const press = useCallback((key: "right" | "back") => setInput({ [key]: true }), []);
  const release = useCallback(
    (key: "right" | "back") => setInput({ [key]: false }),
    [],
  );

  // Safety: once a button's move phase ends (auto-stop at a limit, or the
  // sequence advancing), drop any still-held input so it can't leak into a
  // later state.
  useEffect(() => {
    if (!rightEnabled) release("right");
  }, [rightEnabled, release]);
  useEffect(() => {
    if (!backEnabled) release("back");
  }, [backEnabled, release]);

  return (
    <div className="move-buttons">
      <HoldButton
        label="右 ▶"
        disabled={!rightEnabled}
        onPress={() => press("right")}
        onRelease={() => release("right")}
      />
      <HoldButton
        label="奥 ▲"
        disabled={!backEnabled}
        onPress={() => press("back")}
        onRelease={() => release("back")}
      />
    </div>
  );
}

/** Style 2: pick an (X, Z) target and go there directly. */
function DirectMoveControls() {
  const craneState = useGameState((s) => s.craneState);
  const target = useGameState((s) => s.directTarget);
  const idle = craneState === "IDLE";
  const { minX, maxX, minZ, maxZ } = gameConfig.crane;

  return (
    <div className="direct-controls">
      <div className="direct-row">
        <span className="direct-label">X</span>
        <input
          type="range"
          min={minX}
          max={maxX}
          step={0.01}
          value={target.x}
          disabled={!idle}
          onChange={(e) => setDirectTarget({ x: Number(e.target.value) })}
        />
        <span className="direct-value">{target.x.toFixed(2)}</span>
      </div>
      <div className="direct-row">
        <span className="direct-label">Z</span>
        <input
          type="range"
          min={minZ}
          max={maxZ}
          step={0.01}
          value={target.z}
          disabled={!idle}
          onChange={(e) => setDirectTarget({ z: Number(e.target.value) })}
        />
        <span className="direct-value">{target.z.toFixed(2)}</span>
      </div>
      <button
        type="button"
        className="go-button"
        disabled={!idle}
        onClick={() => goDirect()}
      >
        移動 ▶
      </button>
    </div>
  );
}

export function CraneControls() {
  const controlStyle = useGameState((s) => s.controlStyle);

  return (
    <div className="controls">
      <StyleToggle />
      {controlStyle === "hold" ? <HoldMoveControls /> : <DirectMoveControls />}
      <button className="reset-button" type="button" onClick={() => resetGame()}>
        RESET
      </button>
    </div>
  );
}

interface HoldButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}

function HoldButton({ label, disabled, onPress, onRelease }: HoldButtonProps) {
  return (
    <button
      type="button"
      className="hold-button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore: some pointer types / synthetic events can't be captured
        }
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
