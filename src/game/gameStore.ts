/**
 * Tiny external store shared between the React UI and the physics loop.
 *
 * The physics controller mutates high-frequency values (crane state, prize-get)
 * from inside `useBeforePhysicsStep`, and the UI subscribes via
 * `useSyncExternalStore`. Keeping this outside React avoids per-frame re-renders
 * while still letting buttons/labels react to state changes.
 */

import { useSyncExternalStore } from "react";
import type { CraneState } from "./craneStateMachine";

export interface GameState {
  craneState: CraneState;
  prizeGet: boolean;
  /** Held-button input, driven by pointer events on the on-screen buttons. */
  input: { right: boolean; back: boolean };
  /** Bumped by RESET to trigger imperative re-initialisation everywhere. */
  resetNonce: number;
  /** Debug: master toggle for the tuning panel and helpers. */
  debug: boolean;
  /** Debug: draw Rapier collider wireframes. */
  showColliders: boolean;
  /** Debug: allow OrbitControls instead of the fixed play camera. */
  orbit: boolean;
}

const initialState: GameState = {
  craneState: "IDLE",
  prizeGet: false,
  input: { right: false, back: false },
  resetNonce: 0,
  debug:
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug"),
  showColliders: false,
  orbit: false,
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

export function setDebug(debug: boolean): void {
  setState({ debug });
}

export function setShowColliders(showColliders: boolean): void {
  setState({ showColliders });
}

export function setOrbit(orbit: boolean): void {
  setState({ orbit });
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
