/**
 * Drives the crane through its state machine on a fixed physics timestep
 * (spec §14, §18, §29). It owns:
 *   - the carriage + hub X/Z/Y targets (kinematic bodies — the cabinet's
 *     motors and the winch, spec §3)
 *   - the open/closed command for the claw motors (via a shared ref)
 *   - prize-acquisition polling
 *
 * The winch lowers the hub at a fixed rate. It stops early when the "cable
 * tension" drops below `crane.descentTensionStop` — modelled here as the hung
 * weight minus the contact force the prongs feel: as the claw lands on the
 * prize / rods the cable would go slack (spec §15).
 */

import { useEffect, useRef, type RefObject } from "react";
import { useBeforePhysicsStep } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import type { GameConfig } from "../config/gameConfig";
import {
  clawShouldBeOpen,
  craneReducer,
  type CraneEvent,
  type CraneState,
} from "./craneStateMachine";
import { isPrizeCollected } from "./prizeDetection";
import { getState, setCableTension, setCraneState, setPrizeGet } from "./gameStore";

export interface CraneControllerRefs {
  /** Kinematic trolley at the top (moves X/Z). */
  carriageRef: RefObject<RapierRigidBody | null>;
  /** Kinematic claw hub (moves X/Z with the carriage, Y by the winch). */
  hubRef: RefObject<RapierRigidBody | null>;
  /** Peak prong contact-force magnitude (N) since the last physics step. */
  contactForceRef: RefObject<number>;
  prizeRef: RefObject<RapierRigidBody | null>;
  /** Shared command consumed by the claw assembly's motor loop. */
  clawOpenRef: RefObject<boolean>;
  /** Imperative prize reset, registered by the Prize component. */
  resetPrizeRef: RefObject<(() => void) | null>;
}

interface ControllerRuntime {
  state: CraneState;
  x: number;
  z: number;
  /** Commanded hub Y. */
  hubY: number;
  timer: number;
  lastResetNonce: number;
  /** Consecutive DESCENDING steps reading the cable slack. */
  slackStreak: number;
  /** Low-pass-filtered prong contact force (N). */
  contactEMA: number;
  /** Control style 2: (X, Z) target while MOVING_DIRECT. */
  targetX: number;
  targetZ: number;
  lastDirectGoNonce: number;
}

const EPS = 1e-3;
/** Ignore the slack check until the hub has descended at least this far. */
const DESCEND_MARGIN = 0.1;
/** Consecutive slack steps before halting the descent (debounce). */
const SLACK_STREAK_TO_STOP = 2;
/** Fraction of the hung weight in contact force that halts the descent at once. */
const HARD_CONTACT_FRACTION = 0.55;
/**
 * Per-step smoothing for the contact force. The cable does not go slack the
 * instant a prong bumps something — it slackens only as the claw settles its
 * weight onto the obstacle. So we feed the descent-stop a low-pass average
 * (~5-frame time constant) instead of the raw per-step peak, which a single
 * impact spike would otherwise use to zero the tension.
 */
const CONTACT_SMOOTH = 0.2;

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useCraneController(
  refs: CraneControllerRefs,
  config: GameConfig,
): void {
  const { carriageRef, hubRef, contactForceRef, prizeRef, clawOpenRef, resetPrizeRef } =
    refs;
  const { crane, goal, physics } = config;

  const rt = useRef<ControllerRuntime>({
    state: "IDLE",
    x: crane.homeX,
    z: crane.homeZ,
    hubY: crane.homeY,
    timer: 0,
    lastResetNonce: 0,
    slackStreak: 0,
    contactEMA: 0,
    targetX: crane.homeX,
    targetZ: crane.homeZ,
    lastDirectGoNonce: 0,
  });

  useEffect(() => {
    const r = rt.current;
    r.x = crane.homeX;
    r.z = crane.homeZ;
    r.hubY = crane.homeY;
  }, [crane.homeX, crane.homeY, crane.homeZ]);

  useBeforePhysicsStep(() => {
    const r = rt.current;
    const c = config.crane;
    const dt = physics.timeStep;
    const store = getState();

    // Consume the contact force accumulated during the previous step, and fold
    // it into a low-pass average. A single-frame impact spike hardly moves the
    // average; a prong that has actually come to rest ramps it up over a few
    // frames.
    const contactForce = contactForceRef.current;
    contactForceRef.current = 0;
    r.contactEMA += (contactForce - r.contactEMA) * CONTACT_SMOOTH;
    const smoothForce = r.contactEMA;

    const dispatch = (event: CraneEvent) => {
      r.state = craneReducer(r.state, event);
      r.timer = 0;
      r.slackStreak = 0;
      r.contactEMA = 0;
    };

    // "Cable tension": full hung weight, minus how hard the prongs are pressing
    // on something below (smoothed). Drops toward 0 as the claw settles.
    const hangWeight = (c.hubMass + 2 * config.claw.mass) * -config.gravity;
    const tension = Math.max(0, hangWeight - smoothForce);

    /* ---- RESET ---- */
    if (store.resetNonce !== r.lastResetNonce) {
      r.lastResetNonce = store.resetNonce;
      dispatch("RESET");
      r.x = c.homeX;
      r.z = c.homeZ;
      r.hubY = c.homeY;
      resetPrizeRef.current?.();
      setPrizeGet(false);
      dispatch("RESET_DONE");
    }

    /* ---- control style 2: submit an (X, Z) target ---- */
    if (store.directGoNonce !== r.lastDirectGoNonce) {
      r.lastDirectGoNonce = store.directGoNonce;
      if (r.state === "IDLE") {
        r.targetX = clamp(store.directTarget.x, c.minX, c.maxX);
        r.targetZ = clamp(store.directTarget.z, c.minZ, c.maxZ);
        dispatch("PRESS_GO");
      }
    }

    /* ---- per-state logic ---- */
    switch (r.state) {
      case "IDLE":
        if (store.input.right) dispatch("PRESS_RIGHT");
        break;

      case "MOVING_X":
        if (store.input.right && r.x < c.maxX - EPS) {
          r.x = Math.min(c.maxX, r.x + c.xSpeed * dt);
        } else {
          r.x = Math.min(c.maxX, r.x);
          dispatch("RELEASE_RIGHT");
        }
        break;

      case "WAITING_Z":
        if (store.input.back) dispatch("PRESS_BACK");
        break;

      case "MOVING_Z":
        if (store.input.back && r.z > c.minZ + EPS) {
          r.z = Math.max(c.minZ, r.z - c.zSpeed * dt);
        } else {
          r.z = Math.max(c.minZ, r.z);
          dispatch("RELEASE_BACK");
        }
        break;

      case "MOVING_DIRECT": {
        // Travel both axes at once toward the player-chosen target.
        r.x = approach(r.x, r.targetX, c.xSpeed * dt);
        r.z = approach(r.z, r.targetZ, c.zSpeed * dt);
        if (Math.abs(r.x - r.targetX) < EPS && Math.abs(r.z - r.targetZ) < EPS) {
          dispatch("ARRIVE_DIRECT");
        }
        break;
      }

      case "OPENING":
        r.timer += dt;
        if (r.timer >= c.openTime) dispatch("OPEN_DONE");
        break;

      case "DESCENDING": {
        r.hubY = approach(r.hubY, c.lowestY, c.descentSpeed * dt);
        const descended = c.topY - r.hubY;
        // A firm contact means the whole arm is taking load: stop at once so
        // the prong joints never get dragged apart. A gentler slack reading
        // (cable going limp) still stops after a couple of frames.
        const hardContact = smoothForce > hangWeight * HARD_CONTACT_FRACTION;
        const slackNow =
          descended > DESCEND_MARGIN && tension < c.descentTensionStop;
        r.slackStreak = slackNow ? r.slackStreak + 1 : 0;
        if (
          (descended > DESCEND_MARGIN && hardContact) ||
          r.slackStreak >= SLACK_STREAK_TO_STOP ||
          Math.abs(r.hubY - c.lowestY) < EPS
        ) {
          dispatch("DESCEND_DONE");
        }
        break;
      }

      case "CLOSING":
        r.timer += dt;
        if (r.timer >= c.settleTime) dispatch("CLOSE_DONE");
        break;

      case "LIFTING":
        r.hubY = approach(r.hubY, c.topY, c.liftSpeed * dt);
        if (Math.abs(r.hubY - c.topY) < EPS) dispatch("LIFT_DONE");
        break;

      case "RETURNING": {
        const step = c.returnSpeed * dt;
        r.x = approach(r.x, c.homeX, step);
        r.z = approach(r.z, c.homeZ, step);
        if (Math.abs(r.x - c.homeX) < EPS && Math.abs(r.z - c.homeZ) < EPS) {
          dispatch("RETURN_DONE");
        }
        break;
      }

      case "RELEASING":
        r.timer += dt;
        if (r.timer >= c.releaseTime) dispatch("RELEASE_DONE");
        break;

      case "RESETTING":
        dispatch("RESET_DONE");
        break;
    }

    /* ---- publish outputs ---- */
    clawOpenRef.current = clawShouldBeOpen(r.state);
    setCraneState(r.state);
    setCableTension(tension);

    carriageRef.current?.setNextKinematicTranslation({
      x: r.x,
      y: c.carriageY,
      z: r.z,
    });
    hubRef.current?.setNextKinematicTranslation({ x: r.x, y: r.hubY, z: r.z });

    const prizeBody = prizeRef.current;
    if (prizeBody && !store.prizeGet) {
      const p = prizeBody.translation();
      if (isPrizeCollected(p, goal)) setPrizeGet(true);
    }
  });
}
