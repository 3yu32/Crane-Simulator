/**
 * Tiny external store shared between the React UI and the physics loop.
 *
 * The physics controller mutates high-frequency values (crane state, prize-get)
 * from inside `useBeforePhysicsStep`, and the UI subscribes via
 * `useSyncExternalStore`. Keeping this outside React avoids per-frame re-renders
 * while still letting buttons/labels react to state changes.
 */

import { useSyncExternalStore } from "react";
import { gameConfig } from "../config/gameConfig";
import type { CraneState } from "./craneStateMachine";

/** Live arm parameters exposed as always-on-screen controls (not debug-only). */
export interface ArmControls {
  /** Claw motor stiffness — grip / closing force. */
  armPower: number;
  /** Hard lower bound for the arm's descent (hub Y). */
  descentLimitY: number;
  /** Descent stops when the cable tension (N) drops below this (cable slack). */
  descentTensionStop: number;
}

/** Per-rod placement; each rod is dragged independently in the 3D view. */
export interface RodPlacement {
  /** Stable identity, independent of array position (rods can be added/removed). */
  id: string;
  /** Height. */
  y: number;
  /** Depth position along Z. */
  z: number;
  /** This rod's own surface friction. */
  friction: number;
}
export interface BridgeControls {
  rods: RodPlacement[];
}

/** Rod count is player-adjustable (add/remove), within sane bounds. */
export const MIN_RODS = 1;
export const MAX_RODS = 10;

/** Prize size, adjustable from an on-screen panel. */
export interface PrizeControls {
  width: number;
  height: number;
  depth: number;
}

/**
 * Style 1 ("hold"): hold 右/奥 to move one axis at a time, as before.
 * Style 2 ("direct"): pick an (X, Z) target directly and the claw travels
 * straight there.
 * Style 3 ("ai"): Qwen2.5-VL looks at the front/side views and picks the
 * (X, Z) target itself, then travels there the same way style 2 does.
 */
export type ControlStyle = "hold" | "direct" | "ai";

/** Player-chosen (X, Z) target for control style 2 (and the AI's for style 3). */
export interface DirectTarget {
  x: number;
  z: number;
}

/** Style 3's AI-play status, shown on its panel. */
export type AiStatus = "idle" | "capturing" | "thinking" | "error";

let nextRodId = 0;
function makeRodId(): string {
  nextRodId += 1;
  return `rod-${nextRodId}`;
}

function initialRods(): RodPlacement[] {
  const { rodCount, rodSpacing, rodHeight, rodCenterZ, friction } = gameConfig.bridge;
  const first = -((rodCount - 1) / 2) * rodSpacing;
  return Array.from({ length: rodCount }, (_, i) => ({
    id: makeRodId(),
    y: rodHeight,
    z: rodCenterZ + first + i * rodSpacing,
    friction,
  }));
}

export interface GameState {
  craneState: CraneState;
  prizeGet: boolean;
  /** Held-button input, driven by pointer events on the on-screen buttons. */
  input: { right: boolean; back: boolean };
  /** Player-adjustable arm parameters, shown on the game screen. */
  armControls: ArmControls;
  /** Per-rod bridge placement, adjustable by dragging each rod. */
  bridgeControls: BridgeControls;
  /** Prize size, adjustable from an on-screen panel. */
  prizeControls: PrizeControls;
  /** Which on-screen operating style is active. */
  controlStyle: ControlStyle;
  /** Style 2's player-chosen (X, Z) target. */
  directTarget: DirectTarget;
  /** Bumped when the player submits `directTarget` (style 2's "move" button). */
  directGoNonce: number;
  /** Bumped by style 3's プレイ button to trigger a capture + AI move. */
  aiPlayNonce: number;
  /** Style 3's current phase, for the on-screen status line. */
  aiStatus: AiStatus;
  /** Style 3's last error message, if aiStatus is "error". */
  aiError: string | null;
  /** The last (X, Z) the AI decided on, for the on-screen readout. */
  aiLastMove: DirectTarget | null;
  /** Live estimate of the winch cable tension (N), for the on-screen readout. */
  cableTension: number;
  /** Bumped by RESET to trigger imperative re-initialisation everywhere. */
  resetNonce: number;
  /** Debug: master toggle for the tuning panel and helpers. */
  debug: boolean;
  /** Debug: draw Rapier collider wireframes. */
  showColliders: boolean;
  /** Debug: allow OrbitControls instead of the fixed play camera. */
  orbit: boolean;
  /** The side view is the big one and the front view is the inset. */
  sideViewSwapped: boolean;
}

const initialState: GameState = {
  craneState: "IDLE",
  prizeGet: false,
  input: { right: false, back: false },
  armControls: {
    armPower: gameConfig.claw.motorStiffness,
    descentLimitY: gameConfig.crane.lowestY,
    descentTensionStop: gameConfig.crane.descentTensionStop,
  },
  bridgeControls: { rods: initialRods() },
  prizeControls: {
    width: gameConfig.prize.width,
    height: gameConfig.prize.height,
    depth: gameConfig.prize.depth,
  },
  controlStyle: "hold",
  directTarget: { x: gameConfig.crane.homeX, z: gameConfig.crane.homeZ },
  directGoNonce: 0,
  aiPlayNonce: 0,
  aiStatus: "idle",
  aiError: null,
  aiLastMove: null,
  cableTension: 0,
  resetNonce: 0,
  debug:
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug"),
  showColliders: false,
  orbit: false,
  sideViewSwapped: false,
};

let state: GameState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getState(): GameState {
  return state;
}

export function setState(patch: Partial<GameState>): void {
  state = { ...state, ...patch };
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __gameStore: unknown }).__gameStore = {
    getState,
    setState,
    setInput,
  };
}

/* ------------------------------------------------------------------ actions */

export function setInput(patch: Partial<GameState["input"]>): void {
  setState({ input: { ...state.input, ...patch } });
}

export function setCraneState(craneState: CraneState): void {
  if (state.craneState !== craneState) setState({ craneState });
}

export function setPrizeGet(prizeGet: boolean): void {
  if (state.prizeGet !== prizeGet) setState({ prizeGet });
}

/** Called every physics step; only pushes an update on a visible change. */
export function setCableTension(cableTension: number): void {
  if (Math.abs(state.cableTension - cableTension) > 0.25) {
    setState({ cableTension });
  }
}

export function setDebug(debug: boolean): void {
  setState({ debug });
}

export function setShowColliders(showColliders: boolean): void {
  setState({ showColliders });
}

export function setOrbit(orbit: boolean): void {
  setState({ orbit });
}

export function toggleSideView(): void {
  setState({ sideViewSwapped: !state.sideViewSwapped });
}

export function setArmControl<K extends keyof ArmControls>(
  key: K,
  value: ArmControls[K],
): void {
  setState({ armControls: { ...state.armControls, [key]: value } });
}

export function setRodPlacement(id: string, patch: Partial<RodPlacement>): void {
  const rods = state.bridgeControls.rods.map((r) => (r.id === id ? { ...r, ...patch } : r));
  setState({ bridgeControls: { rods } });
}

/** Add a rod (up to {@link MAX_RODS}), placed at the mid-height/depth default. */
export function addRod(): void {
  const rods = state.bridgeControls.rods;
  if (rods.length >= MAX_RODS) return;
  const { rodHeight, rodCenterZ, friction } = gameConfig.bridge;
  setState({
    bridgeControls: {
      rods: [...rods, { id: makeRodId(), y: rodHeight, z: rodCenterZ, friction }],
    },
  });
}

/** Remove a rod (down to {@link MIN_RODS}). */
export function removeRod(id: string): void {
  const rods = state.bridgeControls.rods;
  if (rods.length <= MIN_RODS) return;
  setState({ bridgeControls: { rods: rods.filter((r) => r.id !== id) } });
}

export function setPrizeControl<K extends keyof PrizeControls>(
  key: K,
  value: PrizeControls[K],
): void {
  setState({ prizeControls: { ...state.prizeControls, [key]: value } });
}

export function setControlStyle(controlStyle: ControlStyle): void {
  setState({ controlStyle });
}

export function setDirectTarget(patch: Partial<DirectTarget>): void {
  setState({ directTarget: { ...state.directTarget, ...patch } });
}

/** Submit `directTarget`; the controller picks this up only while IDLE. */
export function goDirect(): void {
  setState({ directGoNonce: state.directGoNonce + 1 });
}

/** Style 3's プレイ button: triggers a capture + AI move (see AIPlayer.tsx). */
export function playAI(): void {
  setState({ aiPlayNonce: state.aiPlayNonce + 1, aiStatus: "capturing", aiError: null });
}

export function setAiStatus(aiStatus: AiStatus): void {
  setState({ aiStatus });
}

export function setAiError(aiError: string | null): void {
  setState({ aiError, aiStatus: aiError ? "error" : state.aiStatus });
}

export function setAiLastMove(aiLastMove: DirectTarget): void {
  setState({ aiLastMove });
}

/**
 * Full reset (spec §21): clear inputs, drop the prize-get flag, bump the nonce.
 * The crane controller observes the nonce and drives the machine through
 * RESETTING → IDLE while restoring every body imperatively.
 */
export function resetGame(): void {
  setState({
    prizeGet: false,
    input: { right: false, back: false },
    resetNonce: state.resetNonce + 1,
  });
}

/* -------------------------------------------------------------------- hooks */

export function useGameState<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initialState),
  );
}
