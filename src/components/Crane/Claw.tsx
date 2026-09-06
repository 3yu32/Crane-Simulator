/**
 * One claw prong (spec §10): a flat two-segment dogleg, like a UFO-catcher
 * arm — an upper segment from the pivot, a bend, then a lower segment ending
 * in a small grip tip. Colliders match the visible bars. Dynamic body; driven
 * only through its revolute joint (spring closed / motor open).
 *
 * Local frame: pivot at the origin, segments hang down (−Y). φ is a segment's
 * angle from straight-down, positive toward +X.
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
  const tx = claw.armThickness;
  const tz = claw.armDepth;

  // Segment angles (from -Y, +φ toward +X). Upper leans out, lower turns in,
  // grip tip turns in further still by `gripAngle`.
  const phiUpper = -sign * claw.upperTilt;
  const phiLower = sign * (claw.bendAngle - claw.upperTilt);
  const phiGrip = phiLower + sign * claw.gripAngle;

  const upperEnd: [number, number] = [
    claw.armLength * Math.sin(phiUpper),
    -claw.armLength * Math.cos(phiUpper),
  ];
  const lowerEnd: [number, number] = [
    upperEnd[0] + claw.lowerLength * Math.sin(phiLower),
    upperEnd[1] - claw.lowerLength * Math.cos(phiLower),
  ];

  const upperMid: [number, number, number] = [
    (claw.armLength / 2) * Math.sin(phiUpper),
    -(claw.armLength / 2) * Math.cos(phiUpper),
    0,
  ];
  const lowerMid: [number, number, number] = [
    upperEnd[0] + (claw.lowerLength / 2) * Math.sin(phiLower),
    upperEnd[1] - (claw.lowerLength / 2) * Math.cos(phiLower),
    0,
  ];
  const gripMid: [number, number, number] = [
    lowerEnd[0] + (claw.gripLength / 2) * Math.sin(phiGrip),
    lowerEnd[1] - (claw.gripLength / 2) * Math.cos(phiGrip),
    0,
  ];

  const barMat = (
    <meshStandardMaterial
      color="#dfe4ee"
      transparent
      opacity={0.72}
      roughness={0.15}
      metalness={0.1}
    />
  );

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
      onContactForce={(p) => onContactForce(p.totalForceMagnitude)}
      ccd={physics.ccd}
      canSleep={false}
    >
      <CuboidCollider
        args={[tx / 2, claw.armLength / 2, tz / 2]}
        position={upperMid}
        rotation={[0, 0, phiUpper]}
        friction={claw.friction}
        restitution={claw.restitution}
      />
      <CuboidCollider
        args={[tx / 2, claw.lowerLength / 2, tz / 2]}
        position={lowerMid}
        rotation={[0, 0, phiLower]}
        friction={claw.friction}
        restitution={claw.restitution}
      />
      <CuboidCollider
        args={[claw.gripThickness / 2, claw.gripLength / 2, claw.gripThickness * 1.3]}
        position={gripMid}
        rotation={[0, 0, phiGrip]}
        friction={claw.friction}
        restitution={claw.restitution}
      />

      <mesh position={upperMid} rotation={[0, 0, phiUpper]} castShadow>
        <boxGeometry args={[tx, claw.armLength, tz]} />
        {barMat}
      </mesh>
      <mesh position={lowerMid} rotation={[0, 0, phiLower]} castShadow>
        <boxGeometry args={[tx, claw.lowerLength, tz]} />
        {barMat}
      </mesh>
      <mesh position={gripMid} rotation={[0, 0, phiGrip]} castShadow>
        <boxGeometry
          args={[claw.gripThickness, claw.gripLength, claw.gripThickness * 2.6]}
        />
        <meshStandardMaterial color="#c7a24a" roughness={0.5} metalness={0.4} />
      </mesh>
    </RigidBody>
  );
});
