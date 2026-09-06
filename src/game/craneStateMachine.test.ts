import { describe, expect, it } from "vitest";
import {
  clawShouldBeOpen,
  craneReducer,
  enabledButtons,
  type CraneEvent,
  type CraneState,
} from "./craneStateMachine";

/** Apply a sequence of events starting from IDLE and return the final state. */
function run(events: CraneEvent[], start: CraneState = "IDLE"): CraneState {
  return events.reduce(craneReducer, start);
}

describe("craneReducer - happy path", () => {
  it("walks the full sequence back to IDLE", () => {
    const states: CraneState[] = [];
    let state: CraneState = "IDLE";
    const events: CraneEvent[] = [
      "PRESS_RIGHT",
      "RELEASE_RIGHT",
      "PRESS_BACK",
      "RELEASE_BACK",
      "OPEN_DONE",
      "DESCEND_DONE",
      "CLOSE_DONE",
      "LIFT_DONE",
      "RETURN_DONE",
      "RELEASE_DONE",
    ];
    for (const e of events) {
      state = craneReducer(state, e);
      states.push(state);
    }
    expect(states).toEqual([
      "MOVING_X",
      "WAITING_Y",
      "MOVING_Y",
      "OPENING",
      "DESCENDING",
      "CLOSING",
      "LIFTING",
      "RETURNING",
      "RELEASING",
      "IDLE",
    ]);
  });
});

describe("craneReducer - guards", () => {
  it("ignores events that do not apply to the current state", () => {
    expect(craneReducer("IDLE", "PRESS_BACK")).toBe("IDLE");
    expect(craneReducer("IDLE", "RELEASE_RIGHT")).toBe("IDLE");
    expect(craneReducer("MOVING_X", "PRESS_BACK")).toBe("MOVING_X");
    expect(craneReducer("DESCENDING", "CLOSE_DONE")).toBe("DESCENDING");
    expect(craneReducer("CLOSING", "DESCEND_DONE")).toBe("CLOSING");
  });

  it("does not allow the back button before X is confirmed", () => {
    expect(run(["PRESS_RIGHT", "PRESS_BACK"])).toBe("MOVING_X");
  });

  it("enables the back button only after releasing right", () => {
    expect(run(["PRESS_RIGHT", "RELEASE_RIGHT"])).toBe("WAITING_Y");
    expect(run(["PRESS_RIGHT", "RELEASE_RIGHT", "PRESS_BACK"])).toBe("MOVING_Y");
  });

  it("starts the automatic sequence as soon as back is released", () => {
    expect(
      run(["PRESS_RIGHT", "RELEASE_RIGHT", "PRESS_BACK", "RELEASE_BACK"]),
    ).toBe("OPENING");
  });
});

describe("craneReducer - reset", () => {
  it("jumps to RESETTING from any state", () => {
    const froms: CraneState[] = [
      "IDLE",
      "MOVING_X",
      "MOVING_Y",
      "DESCENDING",
      "CLOSING",
      "RETURNING",
      "RELEASING",
    ];
    for (const from of froms) {
      expect(craneReducer(from, "RESET")).toBe("RESETTING");
    }
  });

  it("returns to IDLE when reset completes", () => {
    expect(craneReducer("RESETTING", "RESET_DONE")).toBe("IDLE");
  });

  it("is idempotent while already resetting", () => {
    expect(craneReducer("RESETTING", "RESET")).toBe("RESETTING");
  });
});

describe("enabledButtons", () => {
  it("enables right in IDLE and while moving X", () => {
    expect(enabledButtons("IDLE")).toEqual({ right: true, back: false });
    expect(enabledButtons("MOVING_X")).toEqual({ right: true, back: false });
  });
  it("enables back in WAITING_Y and while moving Z", () => {
    expect(enabledButtons("WAITING_Y")).toEqual({ right: false, back: true });
    expect(enabledButtons("MOVING_Y")).toEqual({ right: false, back: true });
  });
  it("disables both during the automatic sequence", () => {
    for (const s of [
      "OPENING",
      "DESCENDING",
      "CLOSING",
      "LIFTING",
      "RETURNING",
      "RELEASING",
      "RESETTING",
    ] as CraneState[]) {
      expect(enabledButtons(s)).toEqual({ right: false, back: false });
    }
  });
});

describe("clawShouldBeOpen", () => {
  it("drives open only while reaching for and releasing the prize", () => {
    expect(clawShouldBeOpen("OPENING")).toBe(true);
    expect(clawShouldBeOpen("DESCENDING")).toBe(true);
    expect(clawShouldBeOpen("RELEASING")).toBe(true);
  });
  it("leaves the springs to hold the claws closed everywhere else", () => {
    for (const s of [
      "IDLE",
      "MOVING_X",
      "WAITING_Y",
      "MOVING_Y",
      "CLOSING",
      "LIFTING",
      "RETURNING",
      "RESETTING",
    ] as CraneState[]) {
      expect(clawShouldBeOpen(s)).toBe(false);
    }
  });
});
