/**
 * The crane body: carriage + vertical shaft + claw hub (spec §8). It is a single
 * kinematic-position rigid body — the motors of a real cabinet drive X/Z/Y, so
 * this part is not a full dynamic body (spec §3). The controller feeds it
 * `setNextKinematicTranslation` every physics step.
 *
 * The rigid body's origin is the hub centre; the carriage and shaft meshes sit
 * above it in local space.
 */

import { forwardRef } from "react";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";
import { CRANE_GROUPS } from "../../physics/collisionGroups";

interface CraneProps {
  config: GameConfig;
}

export const Crane = forwardRef<RapierRigidBody, CraneProps>(function Crane(
  { config },
  ref,
) {
  const { crane } = config;
  const shaftLen = 0.9;
  const carriageY = shaftLen + 0.06;
  const hubHalfX = Math.max(0.14, config.claw.pivotSpan / 2 + 0.05);

  return (
    <RigidBody
      ref={ref}
      type="kinematicPosition"
      colliders={false}
      collisionGroups={CRANE_GROUPS}
      position={[crane.homeX, crane.homeY, crane.homeZ]}
      ccd={config.physics.ccd}
    >
      {/* hub */}
      <CuboidCollider args={[hubHalfX, 0.05, 0.09]} position={[0, 0, 0]} />
      {/* shaft */}
      <CuboidCollider args={[0.03, shaftLen / 2, 0.03]} position={[0, shaftLen / 2, 0]} />
      {/* carriage */}
      <CuboidCollider args={[0.26, 0.05, 0.22]} position={[0, carriageY, 0]} />

      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[hubHalfX * 2, 0.1, 0.18]} />
        <meshStandardMaterial color="#9aa1b0" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, shaftLen / 2, 0]} castShadow>
        <boxGeometry args={[0.06, shaftLen, 0.06]} />
        <meshStandardMaterial color="#7c8290" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, carriageY, 0]} castShadow>
        <boxGeometry args={[0.52, 0.1, 0.44]} />
        <meshStandardMaterial color="#aab0be" metalness={0.4} roughness={0.45} />
      </mesh>
    </RigidBody>
  );
});
