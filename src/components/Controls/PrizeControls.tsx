/**
 * Always-on-screen prize-size panel (top-right). Values live in the store and
 * feed the effective GameConfig via `useDebugConfig`; changing them re-mounts
 * the prize body with the new collider.
 */

import {
  setPrizeControl,
  useGameState,
  type PrizeControls as PrizeControlsState,
} from "../../game/gameStore";

interface SliderSpec {
  key: keyof PrizeControlsState;
  label: string;
  min: number;
  max: number;
}

const SLIDERS: SliderSpec[] = [
  { key: "width", label: "幅 (W)", min: 0.15, max: 0.7 },
  { key: "height", label: "高さ (H)", min: 0.2, max: 1.2 },
  { key: "depth", label: "奥行 (D)", min: 0.15, max: 0.7 },
];

export function PrizeControls() {
  const prize = useGameState((s) => s.prizeControls);

  return (
    <div className="prize-controls">
      <div className="prize-controls-title">PRIZE SIZE</div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="arm-control-row">
          <span className="arm-control-label">{s.label}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={0.01}
            value={prize[s.key]}
            onChange={(e) =>
              setPrizeControl(s.key, e.currentTarget.valueAsNumber)
            }
          />
          <span className="arm-control-value">{prize[s.key].toFixed(2)}</span>
        </label>
      ))}
    </div>
  );
}
