/**
 * Always-on-screen arm tuning (not behind debug mode): arm power, descent
 * limit and descent-stop force. Values live in the game store and feed the
 * effective GameConfig via `useDebugConfig`.
 */

import { setArmControl, useGameState, type ArmControls as ArmControlsState } from "../../game/gameStore";

interface SliderSpec {
  key: keyof ArmControlsState;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Format the current value for display. */
  format: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: "armPower",
    label: "アームパワー",
    min: 20,
    max: 1200,
    step: 10,
    format: (v) => String(Math.round(v)),
  },
  {
    key: "descentLimitY",
    label: "下降リミット (Y)",
    min: 1.2,
    max: 2.8,
    step: 0.02,
    format: (v) => v.toFixed(2),
  },
  {
    key: "descentStopForce",
    label: "下降停止力 (0=OFF)",
    min: 0,
    max: 120,
    step: 1,
    format: (v) => (v <= 0 ? "OFF" : String(Math.round(v))),
  },
];

export function ArmControls() {
  const armControls = useGameState((s) => s.armControls);

  return (
    <div className="arm-controls">
      <div className="arm-controls-title">ARM</div>
      {SLIDERS.map((s) => {
        const value = armControls[s.key];
        return (
          <label key={s.key} className="arm-control-row">
            <span className="arm-control-label">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value}
              onChange={(e) => setArmControl(s.key, e.currentTarget.valueAsNumber)}
            />
            <span className="arm-control-value">{s.format(value)}</span>
          </label>
        );
      })}
    </div>
  );
}
