/**
 * Always-on-screen bridge panel: each rod's friction, height and depth (Z)
 * are independently adjustable here (mirroring/duplicating the in-scene
 * height/Z drag), and rods can be added or removed on the spot.
 */

import {
  MAX_RODS,
  MIN_RODS,
  ROD_FRICTION_MAX,
  addRod,
  removeRod,
  setRodPlacement,
  useGameState,
} from "../../game/gameStore";

const HEIGHT_MIN = 0.45;
const HEIGHT_MAX = 2.6;
const Z_MIN = -1.5;
const Z_MAX = 1.5;

export function BridgeControls() {
  const rods = useGameState((s) => s.bridgeControls.rods);

  return (
    <div className="bridge-controls">
      <div className="bridge-controls-title">BRIDGE</div>
      <div className="bridge-rod-list">
        {rods.map((rod, i) => (
          <div key={rod.id} className="bridge-rod-card">
            <div className="bridge-rod-header">
              <span>バー {i + 1}</span>
              <button
                type="button"
                className="bridge-rod-remove"
                disabled={rods.length <= MIN_RODS}
                onClick={() => removeRod(rod.id)}
                title="このバーを削除"
              >
                ×
              </button>
            </div>
            <label className="arm-control-row">
              <span className="arm-control-label">摩擦</span>
              <input
                type="range"
                min={0}
                max={ROD_FRICTION_MAX}
                step={0.1}
                value={rod.friction}
                onChange={(e) =>
                  setRodPlacement(rod.id, { friction: e.currentTarget.valueAsNumber })
                }
              />
              <span className="arm-control-value">{rod.friction.toFixed(2)}</span>
            </label>
            <label className="arm-control-row">
              <span className="arm-control-label">高さ</span>
              <input
                type="range"
                min={HEIGHT_MIN}
                max={HEIGHT_MAX}
                step={0.01}
                value={rod.y}
                onChange={(e) =>
                  setRodPlacement(rod.id, { y: e.currentTarget.valueAsNumber })
                }
              />
              <span className="arm-control-value">{rod.y.toFixed(2)}</span>
            </label>
            <label className="arm-control-row">
              <span className="arm-control-label">奥行き</span>
              <input
                type="range"
                min={Z_MIN}
                max={Z_MAX}
                step={0.01}
                value={rod.z}
                onChange={(e) =>
                  setRodPlacement(rod.id, { z: e.currentTarget.valueAsNumber })
                }
              />
              <span className="arm-control-value">{rod.z.toFixed(2)}</span>
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bridge-add-button"
        disabled={rods.length >= MAX_RODS}
        onClick={() => addRod()}
      >
        ＋ バー追加
      </button>
    </div>
  );
}
