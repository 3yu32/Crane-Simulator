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
  /** Hard lower bound for the arm's descent (hub height Z). */
  descentLimitZ: number;
  /** Descent stops when the cable tension (N) drops below this (cable slack). */
  descentTensionStop: number;
  /**
   * Total hanging weight of the arm (hub + both prongs), in newtons. Scales the
   * hub bookkeeping mass and the physical prong mass together from their config
   * defaults, so a heavier arm presses down harder and resists being pushed open.
   */
  armWeightN: number;
}

/** Arm hanging weight (N) with the config default masses — the slider's base. */
export const DEFAULT_ARM_WEIGHT_N =
  (gameConfig.crane.hubMass + 2 * gameConfig.claw.mass) * -gameConfig.gravity;
export const ARM_WEIGHT_MIN = Math.round(DEFAULT_ARM_WEIGHT_N);
export const ARM_WEIGHT_MAX = 90;

/** Player-adjustable X/Y travel limits for the crane (on-screen ARM panel). */
export interface CraneBounds {
  minX: number;
  maxX: number;
  /** minY is the deepest into the cabinet; maxY is the front / home edge. */
  minY: number;
  maxY: number;
}

/**
 * Hard stops on the travel-limit sliders: the cabinet interior
 * (`floor.bounds`) inset by enough that the claw assembly (and a carried
 * prize) can't be driven through a wall.
 */
const CRANE_WALL_MARGIN = 0.7;
const [FB_MIN_X, FB_MAX_X, FB_MIN_Y, FB_MAX_Y] = gameConfig.floor.bounds;
export const CRANE_BOUND_LIMITS = {
  minX: FB_MIN_X + CRANE_WALL_MARGIN,
  maxX: FB_MAX_X - CRANE_WALL_MARGIN,
  minY: FB_MIN_Y + CRANE_WALL_MARGIN,
  maxY: FB_MAX_Y - CRANE_WALL_MARGIN,
};

function clampToBoundLimits<K extends keyof CraneBounds>(key: K, v: number): number {
  const L = CRANE_BOUND_LIMITS;
  return key === "minX" || key === "maxX"
    ? Math.min(L.maxX, Math.max(L.minX, v))
    : Math.min(L.maxY, Math.max(L.minY, v));
}

/** Clamp a full CraneBounds to the wall margin and keep a min<max gap. */
function sanitizeBounds(b: CraneBounds): CraneBounds {
  const gap = 0.1;
  const minX = clampToBoundLimits("minX", b.minX);
  const maxX = clampToBoundLimits("maxX", b.maxX);
  const minY = clampToBoundLimits("minY", b.minY);
  const maxY = clampToBoundLimits("maxY", b.maxY);
  return {
    minX: Math.min(minX, maxX - gap),
    maxX: Math.max(maxX, minX + gap),
    minY: Math.min(minY, maxY - gap),
    maxY: Math.max(maxY, minY + gap),
  };
}

/** Per-rod placement; each rod is dragged independently in the 3D view. */
export interface RodPlacement {
  /** Stable identity, independent of array position (rods can be added/removed). */
  id: string;
  /** Depth position along Y. */
  y: number;
  /** Height (Z). */
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
/** Upper bound for a rod's friction slider (and the rod colour scale). */
export const ROD_FRICTION_MAX = 20;

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
 * Style 3 ("ai"): the vision model looks at the front/side views and picks
 * the (X, Y) target itself, then travels there the same way style 2 does.
 */
export type ControlStyle = "hold" | "direct" | "ai";

/** Player-chosen (X, Y) target for control style 2 (and the AI's for style 3). */
export interface DirectTarget {
  x: number;
  y: number;
}

/** Style 3's AI-play status, shown on its panel. */
export type AiStatus = "idle" | "capturing" | "thinking" | "recording" | "error";

/** Token usage + cost estimate of the last style-3 request, for the panel. */
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

/** Where the prize is (re)spawned by RESET; updated when the prize is dragged. */
export interface PrizeSpawn {
  position: [number, number, number];
  rotation: [number, number, number];
}

/**
 * A saved snapshot of the on-screen setup — bridge rods (count + each rod's
 * height/depth/friction), the ARM sliders, prize size and prize spawn.
 * Stored in localStorage so it survives a dev-server restart.
 */
export interface SettingsPreset {
  /** Saved-shape version; absent on presets that predate the Y↔Z swap. */
  version?: number;
  rods: RodPlacement[];
  armControls: ArmControls;
  craneBounds: CraneBounds;
  prizeControls: PrizeControls;
  prizeSpawn: PrizeSpawn;
  /** Epoch ms, for the "saved at" label / filled check. */
  savedAt: number;
}

/** Number of preset slots (設定1 … 設定N). */
export const PRESET_SLOTS = 5;
const PRESET_STORAGE_KEY = "crane-game-presets-v1";

/**
 * Bumped when the saved shape changes:
 *  - (no version) predates the Y↔Z axis-name swap
 *  - 2: post-swap field names
 *  - 3: adds armControls.armWeightN
 */
const PRESET_VERSION = 3;

const num = (v: unknown, fallback: number) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

/** Bring a stored preset of any past version up to the current shape. */
function migratePreset(raw: unknown): SettingsPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.version === PRESET_VERSION) return p as unknown as SettingsPreset;

  // Pre-swap presets (no version) named the axes the other way round.
  const preSwap = p.version === undefined;

  const armIn = (p.armControls ?? {}) as Record<string, unknown>;
  const armControls: ArmControls = {
    armPower: num(armIn.armPower, gameConfig.claw.motorStiffness),
    descentLimitZ: num(armIn.descentLimitZ ?? armIn.descentLimitY, gameConfig.crane.lowestZ),
    descentTensionStop: num(armIn.descentTensionStop, gameConfig.crane.descentTensionStop),
    armWeightN: num(armIn.armWeightN, DEFAULT_ARM_WEIGHT_N),
  };

  const cbIn = (p.craneBounds ?? {}) as Record<string, unknown>;
  const craneBounds: CraneBounds = {
    minX: num(cbIn.minX, gameConfig.crane.minX),
    maxX: num(cbIn.maxX, gameConfig.crane.maxX),
    minY: num(preSwap ? cbIn.minZ : cbIn.minY, gameConfig.crane.minY),
    maxY: num(preSwap ? cbIn.maxZ : cbIn.maxY, gameConfig.crane.maxY),
  };

  const rodsIn = Array.isArray(p.rods) ? (p.rods as Record<string, unknown>[]) : [];
  const rods = rodsIn.map((r) => ({
    id: String(r.id ?? ""),
    friction: num(r.friction, 0),
    // Pre-swap: y held height, z held depth — flip to the current meaning.
    y: preSwap ? num(r.z, 0) : num(r.y, 0),
    z: preSwap ? num(r.y, 0) : num(r.z, 0),
  })) as RodPlacement[];

  return {
    version: PRESET_VERSION,
    rods,
    armControls,
    craneBounds,
    prizeControls: p.prizeControls as PrizeControls,
    prizeSpawn: p.prizeSpawn as PrizeSpawn,
    savedAt: num(p.savedAt, Date.now()),
  };
}

function loadPresets(): (SettingsPreset | null)[] {
  const empty = Array.from<SettingsPreset | null>({ length: PRESET_SLOTS }).fill(null);
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return empty;
    return Array.from({ length: PRESET_SLOTS }, (_, i) => {
      const p = parsed[i];
      return p && typeof p === "object" ? migratePreset(p) : null;
    });
  } catch {
    return empty;
  }
}

function persistPresets(presets: (SettingsPreset | null)[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore quota / private-mode errors — presets just won't persist
  }
}

let nextRodId = 0;
function makeRodId(): string {
  nextRodId += 1;
  return `rod-${nextRodId}`;
}

function initialRods(): RodPlacement[] {
  const { rodCount, rodSpacing, rodHeight, rodCenterY, friction } = gameConfig.bridge;
  const first = -((rodCount - 1) / 2) * rodSpacing;
  return Array.from({ length: rodCount }, (_, i) => ({
    id: makeRodId(),
    y: rodCenterY + first + i * rodSpacing,
    z: rodHeight,
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
  /** Player-adjustable X/Z travel limits for the crane. */
  craneBounds: CraneBounds;
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
  /** The AI's one-line strategy note for the last move. */
  aiLastStrategy: string | null;
  /** Token usage + cost of the last AI request, for the on-screen readout. */
  aiLastUsage: AiUsage | null;
  /** Style 3: when on, each AI run is saved to a local folder via the backend. */
  aiLogging: boolean;
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
  /** Prize (re)spawn pose; RESET puts the prize here, drag-release updates it. */
  prizeSpawn: PrizeSpawn;
  /** Saved setups, slots 設定1 … 設定N (null = empty). Backed by localStorage. */
  presets: (SettingsPreset | null)[];
}

const initialState: GameState = {
  craneState: "IDLE",
  prizeGet: false,
  input: { right: false, back: false },
  armControls: {
    armPower: gameConfig.claw.motorStiffness,
    descentLimitZ: gameConfig.crane.lowestZ,
    descentTensionStop: gameConfig.crane.descentTensionStop,
    armWeightN: DEFAULT_ARM_WEIGHT_N,
  },
  craneBounds: sanitizeBounds({
    minX: gameConfig.crane.minX,
    maxX: gameConfig.crane.maxX,
    minY: gameConfig.crane.minY,
    maxY: gameConfig.crane.maxY,
  }),
  bridgeControls: { rods: initialRods() },
  prizeControls: {
    width: gameConfig.prize.width,
    height: gameConfig.prize.height,
    depth: gameConfig.prize.depth,
  },
  controlStyle: "hold",
  directTarget: { x: gameConfig.crane.homeX, y: gameConfig.crane.homeY },
  directGoNonce: 0,
  aiPlayNonce: 0,
  aiStatus: "idle",
  aiError: null,
  aiLastMove: null,
  aiLastStrategy: null,
  aiLastUsage: null,
  aiLogging: false,
  cableTension: 0,
  resetNonce: 0,
  debug:
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug"),
  showColliders: false,
  orbit: false,
  sideViewSwapped: false,
  prizeSpawn: {
    position: [...gameConfig.prize.position] as [number, number, number],
    rotation: [...gameConfig.prize.rotation] as [number, number, number],
  },
  presets: loadPresets(),
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

/** Set one crane travel limit, clamped to the wall margin and keeping min < max. */
export function setCraneBound<K extends keyof CraneBounds>(
  key: K,
  value: number,
): void {
  const b = { ...state.craneBounds, [key]: clampToBoundLimits(key, value) };
  const gap = 0.1;
  if (key === "minX") b.minX = Math.min(b.minX, b.maxX - gap);
  if (key === "maxX") b.maxX = Math.max(b.maxX, b.minX + gap);
  if (key === "minY") b.minY = Math.min(b.minY, b.maxY - gap);
  if (key === "maxY") b.maxY = Math.max(b.maxY, b.minY + gap);
  setState({ craneBounds: b });
}

export function setRodPlacement(id: string, patch: Partial<RodPlacement>): void {
  const rods = state.bridgeControls.rods.map((r) => (r.id === id ? { ...r, ...patch } : r));
  setState({ bridgeControls: { rods } });
}

/** Add a rod (up to {@link MAX_RODS}), placed at the mid-height/depth default. */
export function addRod(): void {
  const rods = state.bridgeControls.rods;
  if (rods.length >= MAX_RODS) return;
  const { rodHeight, rodCenterY, friction } = gameConfig.bridge;
  setState({
    bridgeControls: {
      rods: [...rods, { id: makeRodId(), y: rodCenterY, z: rodHeight, friction }],
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

export function setAiLastUsage(aiLastUsage: AiUsage | null): void {
  setState({ aiLastUsage });
}

export function setAiLastStrategy(aiLastStrategy: string | null): void {
  setState({ aiLastStrategy });
}

export function toggleAiLogging(): void {
  setState({ aiLogging: !state.aiLogging });
}

/** Update where RESET (re)spawns the prize — called on prize drag-release. */
export function setPrizeSpawn(prizeSpawn: PrizeSpawn): void {
  setState({ prizeSpawn });
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

/* ------------------------------------------------------------------ presets */

/** Snapshot the current setup into slot `i` and persist to localStorage. */
export function savePreset(i: number): void {
  if (i < 0 || i >= PRESET_SLOTS) return;
  const preset: SettingsPreset = {
    version: PRESET_VERSION,
    rods: state.bridgeControls.rods.map((r) => ({ ...r })),
    armControls: { ...state.armControls },
    craneBounds: { ...state.craneBounds },
    prizeControls: { ...state.prizeControls },
    prizeSpawn: {
      position: [...state.prizeSpawn.position],
      rotation: [...state.prizeSpawn.rotation],
    },
    savedAt: Date.now(),
  };
  const presets = state.presets.map((p, idx) => (idx === i ? preset : p));
  persistPresets(presets);
  setState({ presets });
}

/** Apply slot `i` (if filled): bridge/arm/prize-size/prize-spawn, then reset. */
export function loadPreset(i: number): void {
  const preset = state.presets[i];
  if (!preset) return;
  setState({
    bridgeControls: {
      // Fresh ids so the counter can't later collide with a loaded rod.
      rods: preset.rods.map((r) => ({ ...r, id: makeRodId() })),
    },
    armControls: { ...preset.armControls },
    craneBounds: sanitizeBounds(preset.craneBounds ?? state.craneBounds),
    prizeControls: { ...preset.prizeControls },
    prizeSpawn: {
      position: [...preset.prizeSpawn.position],
      rotation: [...preset.prizeSpawn.rotation],
    },
    prizeGet: false,
    input: { right: false, back: false },
    resetNonce: state.resetNonce + 1,
  });
}

/** Empty slot `i` and persist. */
export function clearPreset(i: number): void {
  const presets = state.presets.map((p, idx) => (idx === i ? null : p));
  persistPresets(presets);
  setState({ presets });
}

/* -------------------------------------------------------------------- hooks */

export function useGameState<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initialState),
  );
}
