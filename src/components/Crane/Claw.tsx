/**
 * One claw prong: a dynamic rigid body made of two box colliders — a straight
 * upper arm and an inward-angled tip (spec §10). It hangs from the hub and is
 * driven only through its revolute joint motor; nothing parents the prize to it.
 */

import { forwardRef } from "react";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";
import { CLAW_GROUPS } from "../../physics/collisionGroups";

export type ClawSide = "left" | "right";

interface ClawProps {
  config: GameConfig;
  side: ClawSide;
  /** World-space position of the pivot at mount time. */
  pivotPosition: [number, number, number];
  /** Called with the total contact-force magnitude (N) on each contact event. */
  onContactForce: (magnitude: number) => void;
}

export const Claw = forwardRef<RapierRigidBody, ClawProps>(function Claw(
  { config, side, pivotPosition, onContactForce },
  ref,
) {
  const { claw, physics } = config;
  const sign = side === "left" ? 1 : -1;
  const t = claw.armThickness;
  const half = t / 2;

  const armCenterY = -claw.armLength / 2;
  const tipCenterY = -claw.armLength - (claw.tipLength / 2) * Math.cos(claw.tipAngle);
  const tipCenterX = sign * (claw.tipLength / 2) * Math.sin(claw.tipAngle);

  return (
    <RigidBody
      ref={ref}
      type="dynamic"
      colliders={false}
      collisionGroups={CLAW_GROUPS}
      position={pivotPosition}
      mass={claw.mass}
      friction={claw.friction}
      restitution={claw.restitution}
      linearDamping={claw.linearDamping}
      angularDamping={claw.angularDamping}
      onContactForce={(payload) => onContactForce(payload.totalForceMagnitude)}
      ccd={physics.ccd}
      canSleep={false}
    >
      {/* upper arm */}
      <CuboidCollider
        args={[half, claw.armLength / 2, half]}
        position={[0, armCenterY, 0]}
        friction={claw.friction}
        restitution={claw.restitution}
      />
      {/* angled tip — wider than the arm for a better cradle under the prize */}
      <CuboidCollider
        args={[half * 1.5, claw.tipLength / 2, half * 1.8]}
        position={[tipCenterX, tipCenterY, 0]}
        rotation={[0, 0, sign * claw.tipAngle]}
        friction={claw.friction}
        restitution={claw.restitution}
      />

      <mesh position={[0, armCenterY, 0]} castShadow>
        <boxGeometry args={[t, claw.armLength, t]} />
        <meshStandardMaterial color="#c2c8d4" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh
        position={[tipCenterX, tipCenterY, 0]}
        rotation={[0, 0, sign * claw.tipAngle]}
        castShadow
      >
        <boxGeometry args={[t * 1.5, claw.tipLength, t * 1.8]} />
        <meshStandardMaterial color="#d9dde6" metalness={0.5} roughness={0.35} />
      </mesh>
    </RigidBody>
  );
});
