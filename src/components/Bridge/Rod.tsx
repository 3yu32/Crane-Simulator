/**
 * A single bridge rod: a kinematic-position cylinder rigid body with an
 * explicit cylinder collider (spec §6). Rotated 90° about Z so the local +Y
 * cylinder axis points along world +X (the rods run left-to-right). Kinematic
 * so the bridge can be repositioned (height / spacing) by dragging without
 * rebuilding the bodies.
 */

import { forwardRef } from "react";
import {
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";

interface RodProps {
  position: [number, number, number];
  radius: number;
  length: number;
  friction: number;
  restitution: number;
}

export const Rod = forwardRef<RapierRigidBody, RodProps>(function Rod(
  { position, radius, length, friction, restitution },
  ref,
) {
  return (
    <RigidBody
      ref={ref}
      type="kinematicPosition"
      colliders={false}
      position={position}
      rotation={[0, 0, Math.PI / 2]}
    >
      <CylinderCollider
        args={[length / 2, radius]}
        friction={friction}
        restitution={restitution}
      />
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, length, 20]} />
        <meshStandardMaterial color="#c9ccd6" roughness={0.3} metalness={0.7} />
      </mesh>
    </RigidBody>
  );
});
