/**
 * Always-on-screen prize panel (top-right): box size, then the centre-of-mass
 * controls. Values live in the store and feed the effective GameConfig via
 * `useDebugConfig`; size changes re-mount the prize collider, CoM changes are
 * applied live.
 */

import {
  setPrizeControl,
  toggleShowCom,
  useGameState,
  type PrizeControls as PrizeControlsState,
} from "../../game/gameStore";

interface SliderSpec {
  key: keyof PrizeControlsState;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SIZE_SLIDERS: SliderSpec[] = [
  { key: "width", label: "幅 (W)", min: 0.15, max: 0.7, step: 0.01 },
  { key: "height", label: "高さ (H)", min: 0.2, max: 1.2, step: 0.01 },
  { key: "depth", label: "奥行 (D)", min: 0.15, max: 0.7, step: 0.01 },
];

const COM_SLIDERS: SliderSpec[] = [
  { key: "comX", label: "重心 左右", min: -1, max: 1, step: 0.02 },
  { key: "comY", label: "重心 上下", min: -1, max: 1, step: 0.02 },
  { key: "comZ", label: "重心 前後", min: -1, max: 1, step: 0.02 },
  { key: "comShift", label: "重心の移動量", min: 0, max: 1, step: 0.02 },
];

function Row({ spec, value }: { spec: SliderSpec; value: number }) {
  return (
    <label className="arm-control-row">
      <span className="arm-control-label">{spec.label}</span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => setPrizeControl(spec.key, e.currentTarget.valueAsNumber)}
      />
      <span className="arm-control-value">{value.toFixed(2)}</span>
    </label>
  );
}

export function PrizeControls() {
  const prize = useGameState((s) => s.prizeControls);
  const showCom = useGameState((s) => s.showCom);

  return (
    <div className="prize-controls">
      <div className="prize-controls-title">PRIZE SIZE</div>
      {SIZE_SLIDERS.map((s) => (
        <Row key={s.key} spec={s} value={prize[s.key]} />
      ))}

      <div className="prize-controls-subtitle">重心 (箱内・半分を1)</div>
      {COM_SLIDERS.map((s) => (
        <Row key={s.key} spec={s} value={prize[s.key]} />
      ))}

      <button
        type="button"
        className={showCom ? "prize-viz-toggle on" : "prize-viz-toggle"}
        onClick={() => toggleShowCom()}
      >
        重心を表示 {showCom ? "ON" : "OFF"}
      </button>
    </div>
  );
}
