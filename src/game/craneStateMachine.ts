/**
 * Explicit finite state machine for the automatic crane sequence (spec §14, §29).
 *
 * This module is pure: no React, no Three.js, no physics. It only knows how a
 * state responds to an event. All timing, movement and physics live in the
 * controller that drives it.
 */

export type CraneState =
  | "IDLE"
  | "MOVING_X"
  | "WAITING_Z"
  | "MOVING_Z"
  | "OPENING"
  | "DESCENDING"
  | "CLOSING"
  | "LIFTING"
  | "RETURNING"
  | "RELEASING"
  | "RESETTING";

export type CraneEvent =
  | "PRESS_RIGHT"
  | "RELEASE_RIGHT"
  | "PRESS_BACK"
  | "RELEASE_BACK"
  | "OPEN_DONE"
  | "DESCEND_DONE"
  | "CLOSE_DONE"
  | "LIFT_DONE"
  | "RETURN_DONE"
  | "RELEASE_DONE"
  | "RESET"
  | "RESET_DONE";

/** The canonical happy-path order of automatic states, for reference/tests. */
export const AUTO_SEQUENCE: readonly CraneState[] = [
  "OPENING",
  "DESCENDING",
  "CLOSING",
  "LIFTING",
  "RETURNING",
  "RELEASING",
];

const TRANSITIONS: Record<CraneState, Partial<Record<CraneEvent, CraneState>>> = {
  IDLE: {
    PRESS_RIGHT: "MOVING_X",
  },
  MOVING_X: {
    // Released by the player, or auto-released when maxX is reached.
    RELEASE_RIGHT: "WAITING_Z",
  },
  WAITING_Z: {
    PRESS_BACK: "MOVING_Z",
  },
  MOVING_Z: {
    // Released by the player, or auto-released when maxZ is reached.
    // The automatic sequence starts immediately afterwards.
    RELEASE_BACK: "OPENING",
  },
  OPENING: {
    OPEN_DONE: "DESCENDING",
  },
  DESCENDING: {
    DESCEND_DONE: "CLOSING",
  },
  CLOSING: {
    CLOSE_DONE: "LIFTING",
  },
  LIFTING: {
    LIFT_DONE: "RETURNING",
  },
  RETURNING: {
    RETURN_DONE: "RELEASING",
  },
  RELEASING: {
    RELEASE_DONE: "IDLE",
  },
  RESETTING: {
    RESET_DONE: "IDLE",
  },
};

/**
 * Compute the next state. Unknown (state, event) pairs are a no-op and return
 * the current state unchanged. A RESET event is always accepted (except while
 * already resetting) and short-circuits to RESETTING.
 */
export function craneReducer(state: CraneState, event: CraneEvent): CraneState {
  if (event === "RESET") {
    return state === "RESETTING" ? state : "RESETTING";
  }
  const next = TRANSITIONS[state][event];
  return next ?? state;
}

/**
 * Whether each hold-to-move button is interactive in a given state (spec §26).
 * The button stays interactive while its own move is in progress so the player
 * can hold and release it; every other state disables both.
 */
export function enabledButtons(state: CraneState): {
  right: boolean;
  back: boolean;
} {
  return {
    right: state === "IDLE" || state === "MOVING_X",
    back: state === "WAITING_Z" || state === "MOVING_Z",
  };
}

/** Whether the claws should be commanded open in this state. */
export function clawShouldBeOpen(state: CraneState): boolean {
  // Open everywhere except while actively gripping / carrying.
  return !(
    state === "CLOSING" ||
    state === "LIFTING" ||
    state === "RETURNING"
  );
}
