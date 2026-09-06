/**
 * Always-on-screen arm tuning (not behind debug mode): arm power, descent
 * limit, the cable-tension stop threshold, and — in a collapsible section —
 * the crane's X/Z travel limits. Values live in the game store and feed the
 * effective GameConfig via `useDebugConfig`. Also shows the live cable
 * tension so the stop threshold can be judged.
 */

import { useState } from "react";
import {
  ARM_WEIGHT_MAX,
  ARM_WEIGHT_MIN,
  PUSH_DEPTH_MAX,
  PUSH_DEPTH_MIN,
  CRANE_BOUND_LIMITS,
  setArmControl,
  setCraneBound,
  useGameState,
  type ArmControls as ArmControlsState,
  type CraneBounds,
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
    key: "descentLimitZ",
    label: "下降リミット (Z)",
    min: 1.0,
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
  {
    key: "pushDepthM",
    label: "押し込み量 (m)",
    min: PUSH_DEPTH_MIN,
    max: PUSH_DEPTH_MAX,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: "armWeightN",
    label: "アームの重さ (N)",
    min: ARM_WEIGHT_MIN,
    max: ARM_WEIGHT_MAX,
    step: 1,
    format: (v) => v.toFixed(0),
  },
];

interface BoundSpec {
  key: keyof CraneBounds;
  label: string;
  min: number;
  max: number;
}

const BOUND_SLIDERS: BoundSpec[] = [
  { key: "minX", label: "X 最小 (左)", min: CRANE_BOUND_LIMITS.minX, max: CRANE_BOUND_LIMITS.maxX },
  { key: "maxX", label: "X 最大 (右)", min: CRANE_BOUND_LIMITS.minX, max: CRANE_BOUND_LIMITS.maxX },
  { key: "minY", label: "Y 最小 (奥)", min: CRANE_BOUND_LIMITS.minY, max: CRANE_BOUND_LIMITS.maxY },
  { key: "maxY", label: "Y 最大 (手前)", min: CRANE_BOUND_LIMITS.minY, max: CRANE_BOUND_LIMITS.maxY },
];

export function ArmControls() {
  const armControls = useGameState((s) => s.armControls);
  const craneBounds = useGameState((s) => s.craneBounds);
  const cableTension = useGameState((s) => s.cableTension);
  const [boundsOpen, setBoundsOpen] = useState(false);

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

      <button
        type="button"
        className={boundsOpen ? "arm-bounds-toggle open" : "arm-bounds-toggle"}
        onClick={() => setBoundsOpen((v) => !v)}
      >
        {boundsOpen ? "▾" : "▸"} 可動範囲 (X / Y)
      </button>
      {boundsOpen && (
        <div className="arm-bounds-panel">
          {BOUND_SLIDERS.map((b) => {
            const value = craneBounds[b.key];
            return (
              <label key={b.key} className="arm-control-row">
                <span className="arm-control-label">{b.label}</span>
                <input
                  type="range"
                  min={b.min}
                  max={b.max}
                  step={0.05}
                  value={value}
                  onChange={(e) =>
                    setCraneBound(b.key, e.currentTarget.valueAsNumber)
                  }
                />
                <span className="arm-control-value">{value.toFixed(2)}</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="arm-control-readout">
        <span>糸の張力</span>
        <span className="arm-control-value">
          {Math.max(0, cableTension).toFixed(1)} N
        </span>
      </div>
    </div>
  );
}
