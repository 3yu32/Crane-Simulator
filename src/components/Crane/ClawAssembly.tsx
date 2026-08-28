/**
 * The two-prong claw assembly (spec §9). Each prong is joined to the hub with a
 * revolute joint; a position motor drives it between the open and closed angles.
 *
 * The motor is deliberately *soft*: its stiffness is the configurable
 * "strength". When the prize is between the prongs, the motor torque fights the
 * prize's contact resistance, so the claws may not fully close — producing
 * strong grip / weak grip / mid-slip behaviour instead of an infinitely strong
 * clamp.
 */

import { useEffect, useRef, type RefObject } from "react";
import {
  useBeforePhysicsStep,
  useRapier,
  useRevoluteJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Vector3 } from "three";
import type { GameConfig } from "../../config/gameConfig";
import { Claw } from "./Claw";

interface ClawAssemblyProps {
  config: GameConfig;
  craneRef: RefObject<RapierRigidBody | null>;
  /** Open (true) / closed (false) command from the crane controller. */
  clawOpenRef: RefObject<boolean>;
  /** Prongs report their peak contact-force magnitude here each step. */
  contactForceRef: RefObject<number>;
  /** Hub position at mount time, for placing the prong bodies. */
  hubPosition: [number, number, number];
}

export function ClawAssembly({
  config,
  craneRef,
  clawOpenRef,
  contactForceRef,
  hubPosition,
}: ClawAssemblyProps) {
  const { claw } = config;
  const { rapier } = useRapier();

  const leftRef = useRef<RapierRigidBody>(null);
  const rightRef = useRef<RapierRigidBody>(null);

  const halfSpan = claw.pivotSpan / 2;
  const [hx, hy, hz] = hubPosition;

  // The joint hooks are typed against non-null refs; `.current` is null until
  // the bodies mount, which the hook already guards for internally.
  const body1 = craneRef as RefObject<RapierRigidBody>;
  const leftBody = leftRef as RefObject<RapierRigidBody>;
  const rightBody = rightRef as RefObject<RapierRigidBody>;

  // body1 (hub) anchor is offset to each prong's pivot; body2 anchor is the
  // prong's own origin. Rotation axis is world +Z so the prongs swing in X-Y.
  const leftJoint = useRevoluteJoint(body1, leftBody, [
    new Vector3(-halfSpan, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
  ]);
  const rightJoint = useRevoluteJoint(body1, rightBody, [
    new Vector3(halfSpan, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
  ]);

  const modelSet = useRef(false);

  useEffect(() => {
    modelSet.current = false;
  }, [claw.motorStiffness, claw.motorDamping]);

  useBeforePhysicsStep(() => {
    const lj = leftJoint.current;
    const rj = rightJoint.current;
    if (!lj || !rj) return;

    if (!modelSet.current) {
      // Acceleration-based: stiffness/damping behave like a spring frequency,
      // giving a firm but finite hold. Contact forces from a wedged prize can
      // still stall the prongs before they reach the closed angle.
      lj.configureMotorModel(rapier.MotorModel.AccelerationBased);
      rj.configureMotorModel(rapier.MotorModel.AccelerationBased);
      modelSet.current = true;
    }

    const open = clawOpenRef.current;
    // Left prong: open swings the tip outward (−angle), close swings it in (+).
    // Right prong is mirrored.
    const leftTarget = open ? -claw.openAngle : claw.closedAngle;
    const rightTarget = open ? claw.openAngle : -claw.closedAngle;

    lj.configureMotorPosition(leftTarget, claw.motorStiffness, claw.motorDamping);
    rj.configureMotorPosition(
      rightTarget,
      claw.motorStiffness,
      claw.motorDamping,
    );
  });

  const reportForce = (magnitude: number) => {
    if (magnitude > contactForceRef.current) contactForceRef.current = magnitude;
  };

  return (
    <>
      <Claw
        ref={leftRef}
        config={config}
        side="left"
        pivotPosition={[hx - halfSpan, hy, hz]}
        onContactForce={reportForce}
      />
      <Claw
        ref={rightRef}
        config={config}
        side="right"
        pivotPosition={[hx + halfSpan, hy, hz]}
        onContactForce={reportForce}
      />
    </>
  );
}
