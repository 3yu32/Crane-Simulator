/**
 * Drives the crane through its state machine on a fixed physics timestep
 * (spec §14, §18, §29). This hook owns:
 *   - the carriage X/Z target (kinematic body — the cabinet's motors, spec §3)
 *   - the winch: a prismatic-joint position motor that raises/lowers the claw
 *     hub on a simulated cable
 *   - the open/closed command for the claw motors (via a shared ref)
 *   - prize-acquisition polling
 *
 * The hub is a *dynamic* body: it is only ever moved by the cable, gravity and
 * contacts — never teleported. The descent halts when the computed cable
 * tension drops below `crane.descentTensionStop` (the cable going slack because
 * the claw is resting on the prize / rods, spec §15).
 */

import { useEffect, useRef, type RefObject } from "react";
import { useBeforePhysicsStep, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import type { PrismaticImpulseJoint } from "@dimforge/rapier3d-compat";
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
  /** Kinematic trolley at the top. */
  carriageRef: RefObject<RapierRigidBody | null>;
  /** Dynamic claw hub, hanging on the cable. */
  hubRef: RefObject<RapierRigidBody | null>;
  /** Prismatic (Y) joint carriage→hub — its position motor is the winch. */
  winchJointRef: RefObject<PrismaticImpulseJoint | undefined>;
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
  /** Commanded hub target Y (cable length = carriageY - hubTargetY). */
  hubTargetY: number;
  timer: number;
  lastResetNonce: number;
  motorModelSet: boolean;
  /** Consecutive DESCENDING steps with the cable reading slack. */
  slackStreak: number;
}

const EPS = 1e-3;
/** Ignore the slack check until the hub has descended at least this far. */
const TENSION_CHECK_MARGIN = 0.14;
/** Consecutive slack steps required before halting the descent (debounce). */
const SLACK_STREAK_TO_STOP = 4;

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

export function useCraneController(
  refs: CraneControllerRefs,
  config: GameConfig,
): void {
  const {
    carriageRef,
    hubRef,
    winchJointRef,
    prizeRef,
    clawOpenRef,
    resetPrizeRef,
  } = refs;
  const { crane, goal, physics } = config;
  const { rapier } = useRapier();

  const rt = useRef<ControllerRuntime>({
    state: "IDLE",
    x: crane.homeX,
    z: crane.homeZ,
    hubTargetY: crane.homeY,
    timer: 0,
    lastResetNonce: 0,
    motorModelSet: false,
    slackStreak: 0,
  });

  useEffect(() => {
    const r = rt.current;
    r.x = crane.homeX;
    r.z = crane.homeZ;
    r.hubTargetY = crane.homeY;
  }, [crane.homeX, crane.homeY, crane.homeZ]);

  useBeforePhysicsStep(() => {
    const r = rt.current;
    const cfg = config;
    const c = cfg.crane;
    const dt = physics.timeStep;
    const store = getState();
    const carriage = carriageRef.current;
    const hub = hubRef.current;
    const joint = winchJointRef.current;

    const dispatch = (event: CraneEvent) => {
      r.state = craneReducer(r.state, event);
      r.timer = 0;
      r.slackStreak = 0;
    };

    /* ---- cable tension estimate ----------------------------------------------
     * Rapier's JS build doesn't expose joint reaction forces, so tension is
     * derived kinematically: the cable is taut (holding the full hung weight)
     * while the hub keeps pace with the winch, and goes slack as the hub falls
     * behind — i.e. when the claw is resting on the prize / rods.
     */
    const hangWeight = (c.hubMass + 2 * cfg.claw.mass) * -cfg.gravity;
    let tension = hangWeight;
    if (hub && r.state === "DESCENDING") {
      const followRate = Math.max(0, -hub.linvel().y) / c.descentSpeed;
      tension = hangWeight * Math.min(1, followRate);
    }

    /* ---- RESET ---- */
    if (store.resetNonce !== r.lastResetNonce) {
      r.lastResetNonce = store.resetNonce;
      dispatch("RESET");
      r.x = c.homeX;
      r.z = c.homeZ;
      r.hubTargetY = c.homeY;
      resetPrizeRef.current?.();
      setPrizeGet(false);
      dispatch("RESET_DONE");
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

      case "OPENING":
        r.timer += dt;
        if (r.timer >= c.openTime) dispatch("OPEN_DONE");
        break;

      case "DESCENDING": {
        r.hubTargetY = approach(r.hubTargetY, c.lowestY, c.descentSpeed * dt);
        const descended = c.topY - r.hubTargetY;
        const slackNow =
          descended > TENSION_CHECK_MARGIN && tension < c.descentTensionStop;
        r.slackStreak = slackNow ? r.slackStreak + 1 : 0;
        if (
          r.slackStreak >= SLACK_STREAK_TO_STOP ||
          Math.abs(r.hubTargetY - c.lowestY) < EPS
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
        r.hubTargetY = approach(r.hubTargetY, c.topY, c.liftSpeed * dt);
        if (Math.abs(r.hubTargetY - c.topY) < EPS) dispatch("LIFT_DONE");
        break;

      case "RETURNING": {
        const step = c.returnSpeed * dt;
        r.x = approach(r.x, c.homeX, step);
        r.z = approach(r.z, c.homeZ, step);
        if (
          Math.abs(r.x - c.homeX) < EPS &&
          Math.abs(r.z - c.homeZ) < EPS
        ) {
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

    if (carriage) {
      carriage.setNextKinematicTranslation({
        x: r.x,
        y: c.carriageY,
        z: r.z,
      });
    }

    if (joint) {
      if (!r.motorModelSet) {
        // Force-based: stiffness / damping are real N/m and N·s/m, so the
        // tension estimate above matches the force Rapier actually applies.
        joint.configureMotorModel(rapier.MotorModel.ForceBased);
        r.motorModelSet = true;
      }
      joint.configureMotorPosition(
        r.hubTargetY - c.carriageY,
        c.cableStiffness,
        c.cableDamping,
      );
    }

    const prizeBody = prizeRef.current;
    if (prizeBody && !store.prizeGet) {
      const p = prizeBody.translation();
      if (isPrizeCollected(p, goal)) setPrizeGet(true);
    }
  });
}
