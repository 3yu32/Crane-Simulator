/**
 * On-screen controls (spec §11, §25, §26): two hold-to-move buttons and RESET.
 * Pointer events are used so mouse and touch behave identically — press starts
 * movement, release stops it.
 */

import { useCallback, useEffect } from "react";
import { AI_PLAY_ENABLED } from "../../config/features";
import { LOCAL_BACKEND_AVAILABLE } from "../../game/aiPlayer";
import { enabledButtons } from "../../game/craneStateMachine";
import { useApiKey } from "../../game/geminiKey";
import { ApiKeyField } from "./ApiKeyField";
import {
  goDirect,
  playAI,
  resetGame,
  setControlStyle,
  setDirectTarget,
  setInput,
  toggleAiLogging,
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
      {AI_PLAY_ENABLED && (
        <button
          type="button"
          className={controlStyle === "ai" ? "style-btn active" : "style-btn"}
          onClick={() => setControlStyle("ai")}
        >
          スタイル3
        </button>
      )}
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

/** Style 2: pick an (X, Y) target and go there directly. */
function DirectMoveControls() {
  const craneState = useGameState((s) => s.craneState);
  const target = useGameState((s) => s.directTarget);
  const { minX, maxX, minY, maxY } = useGameState((s) => s.craneBounds);
  const idle = craneState === "IDLE";

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
        <span className="direct-label">Y</span>
        <input
          type="range"
          min={minY}
          max={maxY}
          step={0.01}
          value={target.y}
          disabled={!idle}
          onChange={(e) => setDirectTarget({ y: Number(e.target.value) })}
        />
        <span className="direct-value">{target.y.toFixed(2)}</span>
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

/** Style 3: Gemini looks at the two views and picks the (X, Y) itself. */
function AIMoveControls() {
  const craneState = useGameState((s) => s.craneState);
  const aiStatus = useGameState((s) => s.aiStatus);
  const aiError = useGameState((s) => s.aiError);
  const aiLastMove = useGameState((s) => s.aiLastMove);
  const aiLastStrategy = useGameState((s) => s.aiLastStrategy);
  const aiLastUsage = useGameState((s) => s.aiLastUsage);
  const aiLogging = useGameState((s) => s.aiLogging);
  const apiKey = useApiKey();
  // Without a local backend (static deploy) the visitor's own key is required.
  const needsKey = !LOCAL_BACKEND_AVAILABLE && !apiKey;
  const idle = craneState === "IDLE";
  const busy =
    aiStatus === "capturing" || aiStatus === "thinking" || aiStatus === "recording";

  const buttonLabel = busy
    ? aiStatus === "capturing"
      ? "撮影中…"
      : aiStatus === "recording"
        ? "記録中…"
        : "AI思考中…"
    : "▶ AIプレイ";

  return (
    <div className="ai-controls">
      <ApiKeyField />
      <button
        type="button"
        className="go-button"
        disabled={!idle || busy || needsKey}
        onClick={() => playAI()}
      >
        {buttonLabel}
      </button>
      {LOCAL_BACKEND_AVAILABLE && !apiKey && (
        <button
          type="button"
          className={aiLogging ? "ai-log-toggle on" : "ai-log-toggle"}
          disabled={busy}
          onClick={() => toggleAiLogging()}
        >
          ローカル保存: {aiLogging ? "ON" : "OFF"}
        </button>
      )}
      {aiLastStrategy && (
        <div className="ai-status-line ai-strategy">作戦: {aiLastStrategy}</div>
      )}
      {aiLastMove && (
        <div className="ai-status-line">
          前回の手: X={aiLastMove.x.toFixed(2)} Y={aiLastMove.y.toFixed(2)}
        </div>
      )}
      {aiLastUsage && (
        <div className="ai-status-line">
          {aiLastUsage.totalTokens} tok
          {aiLastUsage.costUsd != null && ` / $${aiLastUsage.costUsd.toFixed(5)}`}
        </div>
      )}
      {aiStatus === "error" && aiError && <div className="ai-status-error">{aiError}</div>}
    </div>
  );
}

export function CraneControls() {
  const controlStyle = useGameState((s) => s.controlStyle);

  return (
    <div className="controls">
      <StyleToggle />
      {controlStyle === "hold" && <HoldMoveControls />}
      {controlStyle === "direct" && <DirectMoveControls />}
      {controlStyle === "ai" && <AIMoveControls />}
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
