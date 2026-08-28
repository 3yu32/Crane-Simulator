/**
 * A single bridge rod: a fixed cylinder rigid body with an explicit cylinder
 * collider (spec §6). The rigid body is rotated 90° about X so the local +Y
 * cylinder axis points along world +Z.
 */

import { CylinderCollider, RigidBody } from "@react-three/rapier";

interface RodProps {
  position: [number, number, number];
  radius: number;
  length: number;
  friction: number;
  restitution: number;
}

export function Rod({
  position,
  radius,
  length,
  friction,
  restitution,
}: RodProps) {
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
      rotation={[Math.PI / 2, 0, 0]}
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
}
