/**
 * 設定プリセット: save / load a few named snapshots of the on-screen setup
 * (bridge rods + count, ARM sliders, prize size, prize spawn pose). Stored in
 * localStorage by the game store, so they survive a dev-server restart.
 *
 * A collapsible card rather than a permanent panel — the screen edges are
 * already full.
 */

import { useState } from "react";
import {
  PRESET_SLOTS,
  clearPreset,
  loadPreset,
  savePreset,
  useGameState,
} from "../../game/gameStore";

function savedAtLabel(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PresetControls() {
  const presets = useGameState((s) => s.presets);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={open ? "preset-toggle open" : "preset-toggle"}
        onClick={() => setOpen((v) => !v)}
      >
        設定プリセット
      </button>

      {open && (
        <div className="preset-panel">
          {Array.from({ length: PRESET_SLOTS }, (_, i) => {
            const preset = presets[i] ?? null;
            return (
              <div key={i} className="preset-row">
                <span className="preset-label">
                  設定{i + 1}
                  {preset && (
                    <span className="preset-time">{savedAtLabel(preset.savedAt)}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => savePreset(i)}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  disabled={!preset}
                  onClick={() => {
                    loadPreset(i);
                    setOpen(false);
                  }}
                >
                  読込
                </button>
                <button
                  type="button"
                  className="preset-btn preset-clear"
                  disabled={!preset}
                  title="この設定を削除"
                  onClick={() => clearPreset(i)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
