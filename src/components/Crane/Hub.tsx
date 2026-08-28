/**
 * The claw hub — the moving head the two prongs are jointed to. It is a
 * kinematic-position body: the controller drives its X/Z (with the carriage)
 * and its Y (the winch pays cable out / in). Keeping it kinematic makes it a
 * solid rotational anchor for the prong motors.
 */

import { forwardRef } from "react";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";
import { CRANE_GROUPS } from "../../physics/collisionGroups";

interface HubProps {
  config: GameConfig;
}

export const Hub = forwardRef<RapierRigidBody, HubProps>(function Hub(
  { config },
  ref,
) {
  const { crane } = config;
  const halfX = config.claw.pivotSpan / 2 + 0.12;
  const halfY = 0.09;
  const halfZ = 0.15;

  return (
    <RigidBody
      ref={ref}
      type="kinematicPosition"
      colliders={false}
      collisionGroups={CRANE_GROUPS}
      position={[crane.homeX, crane.homeY, crane.homeZ]}
      ccd={config.physics.ccd}
    >
      <CuboidCollider args={[halfX, halfY, halfZ]} position={[0, 0, 0]} />
      {/* rounded head shell */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[halfZ * 1.05, halfX * 1.7, 6, 16]} />
        <meshStandardMaterial color="#eef1f6" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* pink accent strip on top */}
      <mesh position={[0, halfY + 0.02, 0]}>
        <boxGeometry args={[halfX * 1.6, 0.03, halfZ * 1.2]} />
        <meshStandardMaterial color="#e24a8f" roughness={0.5} />
      </mesh>
    </RigidBody>
  );
});
