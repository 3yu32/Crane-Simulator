/**
 * On-screen controls (spec §11, §25, §26): two hold-to-move buttons and RESET.
 * Pointer events are used so mouse and touch behave identically — press starts
 * movement, release stops it.
 */

import { useCallback, useEffect } from "react";
import { enabledButtons } from "../../game/craneStateMachine";
import { resetGame, setInput, useGameState } from "../../game/gameStore";

export function CraneControls() {
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
    <div className="controls">
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
