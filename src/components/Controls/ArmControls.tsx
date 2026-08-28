/**
 * Always-on-screen arm tuning (not behind debug mode): arm power, descent
 * limit and the cable-tension stop threshold. Values live in the game store
 * and feed the effective GameConfig via `useDebugConfig`. Also shows the live
 * cable tension so the stop threshold can be judged.
 */

import {
  setArmControl,
  useGameState,
  type ArmControls as ArmControlsState,
} from "../../game/gameStore";

interface SliderSpec {
  key: keyof ArmControlsState;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: "armPower",
    label: "アームパワー (バネ)",
    min: 0.5,
    max: 120,
    step: 0.5,
    format: (v) => v.toFixed(1),
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
    key: "descentTensionStop",
    label: "下降停止 張力 (N)",
    min: 0,
    max: 30,
    step: 0.5,
    format: (v) => v.toFixed(1),
  },
];

export function ArmControls() {
  const armControls = useGameState((s) => s.armControls);
  const cableTension = useGameState((s) => s.cableTension);

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
              onChange={(e) =>
                setArmControl(s.key, e.currentTarget.valueAsNumber)
              }
            />
            <span className="arm-control-value">{s.format(value)}</span>
          </label>
        );
      })}
      <div className="arm-control-readout">
        <span>糸の張力</span>
        <span className="arm-control-value">
          {Math.max(0, cableTension).toFixed(1)} N
        </span>
      </div>
    </div>
  );
}
