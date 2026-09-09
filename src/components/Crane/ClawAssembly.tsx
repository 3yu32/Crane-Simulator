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

import { useRef, type RefObject } from "react";
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
  /** The kinematic claw hub the prongs are jointed to. */
  hubRef: RefObject<RapierRigidBody | null>;
  /** Open (true) / closed (false) command from the crane controller. */
  clawOpenRef: RefObject<boolean>;
  /** Prongs report their peak contact-force magnitude here each step. */
  contactForceRef: RefObject<number>;
  /** Hub position at mount time, for placing the prong bodies. */
  hubPosition: [number, number, number];
}

export function ClawAssembly({
  config,
  hubRef,
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

  // Twist: the hub is yawed about the vertical by `twistDeg` (see Hub), so both
  // the hub and the prong bodies share the same yawed local frame — the joint
  // anchors/axis stay in that local frame (unchanged) and only the prong world
  // positions need the yaw applied.
  const twist = (claw.twistDeg * Math.PI) / 180;
  const ox = halfSpan * Math.cos(twist);
  const oz = -halfSpan * Math.sin(twist);

  // The joint hooks are typed against non-null refs; `.current` is null until
  // the bodies mount, which the hook already guards for internally.
  const body1 = hubRef as RefObject<RapierRigidBody>;
  const leftBody = leftRef as RefObject<RapierRigidBody>;
  const rightBody = rightRef as RefObject<RapierRigidBody>;

  // body1 (hub) anchor is offset to each prong's pivot; body2 anchor is the
  // prong's own origin. Rotation axis is world +Z so the prongs swing in X-Y.
  // Limits are created wide and tightened live below. Left angle: open is −,
  // close is +; the right prong is mirrored.
  const leftJoint = useRevoluteJoint(body1, leftBody, [
    new Vector3(-halfSpan, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
    [-Math.PI, Math.PI],
  ]);
  const rightJoint = useRevoluteJoint(body1, rightBody, [
    new Vector3(halfSpan, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
    [-Math.PI, Math.PI],
  ]);

  useBeforePhysicsStep(() => {
    const lj = leftJoint.current;
    const rj = rightJoint.current;
    if (!lj || !rj) return;

    // Force-based: stiffness / damping are real N·m/rad and N·m·s/rad, so the
    // spring torque (= grip force when a prize wedges the prongs) is literally
    // `motorStiffness × angleError`. Re-set every step (cheap, and robust to
    // HMR / re-mounts).
    lj.configureMotorModel(rapier.MotorModel.ForceBased);
    rj.configureMotorModel(rapier.MotorModel.ForceBased);

    // Hard swing limits (magnitudes → signed per side). Keeps an object
    // sliding along a prong from forcing it wider than `limitOpen`.
    lj.setLimits(-claw.limitOpen, claw.limitClose);
    rj.setLimits(-claw.limitClose, claw.limitOpen);

    // Left prong: open swings the tip outward (−angle), close swings it in (+).
    // Right prong is mirrored.
    //
    // OPEN  → a fixed, strong motor pushes each prong to `openAngle`.
    // CLOSE → no drive; a spring (stiffness = motorStiffness = "Arm Power")
    //         pulls each prong toward `closedAngle`. Whatever it wedges against
    //         (the prize) sets the grip force = stiffness × angleError.
    if (clawOpenRef.current) {
      lj.configureMotorPosition(
        -claw.openAngle,
        claw.openStiffness,
        claw.openDamping,
      );
      rj.configureMotorPosition(
        claw.openAngle,
        claw.openStiffness,
        claw.openDamping,
      );
    } else {
      lj.configureMotorPosition(
        claw.closedAngle,
        claw.motorStiffness,
        claw.motorDamping,
      );
      rj.configureMotorPosition(
        -claw.closedAngle,
        claw.motorStiffness,
        claw.motorDamping,
      );
    }
  });

  const reportForce = (m: number) => {
    if (m > contactForceRef.current) contactForceRef.current = m;
  };

  return (
    <>
      <Claw
        ref={leftRef}
        config={config}
        side="left"
        pivotPosition={[hx - ox, hy, hz - oz]}
        yaw={twist}
        onContactForce={reportForce}
      />
      <Claw
        ref={rightRef}
        config={config}
        side="right"
        pivotPosition={[hx + ox, hy, hz + oz]}
        yaw={twist}
        onContactForce={reportForce}
      />
    </>
  );
}
