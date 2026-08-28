/**
 * Drives the crane through its state machine on a fixed physics timestep
 * (spec §14, §18, §29). This hook owns:
 *   - the authoritative crane target position (kinematic body)
 *   - the open/closed command for the claw motors (via a shared ref)
 *   - prize-acquisition polling
 *
 * It never teleports the prize or parents it to the claws (spec §31): the prize
 * is only ever moved by Rapier.
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
import {
  getState,
  setCraneState,
  setPrizeGet,
} from "./gameStore";

export interface CraneControllerRefs {
  craneRef: RefObject<RapierRigidBody | null>;
  prizeRef: RefObject<RapierRigidBody | null>;
  /** Shared command consumed by the claw assembly's motor loop. */
  clawOpenRef: RefObject<boolean>;
  /** Imperative prize reset, registered by the Prize component. */
  resetPrizeRef: RefObject<(() => void) | null>;
  /**
   * Largest claw contact-force magnitude (N) seen since the last physics step,
   * written by the claw bodies. Used to halt the descent on resistance.
   */
  contactForceRef: RefObject<number>;
}

interface ControllerRuntime {
  state: CraneState;
  x: number;
  y: number;
  z: number;
  timer: number;
  lastResetNonce: number;
}

const EPS = 1e-3;

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

export function useCraneController(
  refs: CraneControllerRefs,
  config: GameConfig,
): void {
  const { craneRef, prizeRef, clawOpenRef, resetPrizeRef, contactForceRef } =
    refs;
  const { crane, goal, physics } = config;

  const rt = useRef<ControllerRuntime>({
    state: "IDLE",
    x: crane.homeX,
    y: crane.homeY,
    z: crane.homeZ,
    timer: 0,
    lastResetNonce: 0,
  });

  // Re-home the runtime whenever the config's home changes (e.g. first mount).
  useEffect(() => {
    const r = rt.current;
    r.x = crane.homeX;
    r.y = crane.homeY;
    r.z = crane.homeZ;
  }, [crane.homeX, crane.homeY, crane.homeZ]);

  useBeforePhysicsStep(() => {
    const r = rt.current;
    const cfg = config;
    const dt = physics.timeStep;
    const store = getState();

    const dispatch = (event: CraneEvent) => {
      r.state = craneReducer(r.state, event);
      r.timer = 0;
    };

    // Consume the contact force accumulated during the previous step.
    const contactForce = contactForceRef.current;
    contactForceRef.current = 0;

    /* ---- RESET handling: observe the nonce, restore everything ---- */
    if (store.resetNonce !== r.lastResetNonce) {
      r.lastResetNonce = store.resetNonce;
      dispatch("RESET");
      r.x = cfg.crane.homeX;
      r.y = cfg.crane.homeY;
      r.z = cfg.crane.homeZ;
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
        if (store.input.right && r.x < cfg.crane.maxX - EPS) {
          r.x = Math.min(cfg.crane.maxX, r.x + cfg.crane.xSpeed * dt);
        } else {
          r.x = Math.min(cfg.crane.maxX, r.x);
          dispatch("RELEASE_RIGHT");
        }
        break;

      case "WAITING_Z":
        if (store.input.back) dispatch("PRESS_BACK");
        break;

      case "MOVING_Z":
        // "Deeper into the cabinet" is toward smaller Z (see gameConfig header).
        if (store.input.back && r.z > cfg.crane.minZ + EPS) {
          r.z = Math.max(cfg.crane.minZ, r.z - cfg.crane.zSpeed * dt);
        } else {
          r.z = Math.max(cfg.crane.minZ, r.z);
          dispatch("RELEASE_BACK");
        }
        break;

      case "OPENING":
        r.timer += dt;
        if (r.timer >= cfg.crane.openTime) dispatch("OPEN_DONE");
        break;

      case "DESCENDING": {
        const stopForce = cfg.crane.descentStopForce;
        const blocked = stopForce > 0 && contactForce >= stopForce;
        r.y = approach(r.y, cfg.crane.lowestY, cfg.crane.descentSpeed * dt);
        if (blocked || Math.abs(r.y - cfg.crane.lowestY) < EPS) {
          dispatch("DESCEND_DONE");
        }
        break;
      }

      case "CLOSING":
        r.timer += dt;
        if (r.timer >= cfg.crane.settleTime) dispatch("CLOSE_DONE");
        break;

      case "LIFTING":
        r.y = approach(r.y, cfg.crane.topY, cfg.crane.liftSpeed * dt);
        if (Math.abs(r.y - cfg.crane.topY) < EPS) dispatch("LIFT_DONE");
        break;

      case "RETURNING": {
        const step = cfg.crane.returnSpeed * dt;
        r.x = approach(r.x, cfg.crane.homeX, step);
        r.z = approach(r.z, cfg.crane.homeZ, step);
        if (
          Math.abs(r.x - cfg.crane.homeX) < EPS &&
          Math.abs(r.z - cfg.crane.homeZ) < EPS
        ) {
          dispatch("RETURN_DONE");
        }
        break;
      }

      case "RELEASING":
        r.timer += dt;
        if (r.timer >= cfg.crane.releaseTime) dispatch("RELEASE_DONE");
        break;

      case "RESETTING":
        dispatch("RESET_DONE");
        break;
    }

    /* ---- publish outputs ---- */
    clawOpenRef.current = clawShouldBeOpen(r.state);
    setCraneState(r.state);

    const craneBody = craneRef.current;
    if (craneBody) {
      craneBody.setNextKinematicTranslation({ x: r.x, y: r.y, z: r.z });
    }

    const prizeBody = prizeRef.current;
    if (prizeBody && !store.prizeGet) {
      const p = prizeBody.translation();
      if (isPrizeCollected(p, goal)) setPrizeGet(true);
    }
  });
}
