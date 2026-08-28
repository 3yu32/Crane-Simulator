/**
 * Visual-only cable between the carriage and the hub. Follows the two bodies
 * every frame; the actual constraint is the prismatic joint in CraneRig.
 */

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { RapierRigidBody } from "@react-three/rapier";

interface CableProps {
  carriageRef: RefObject<RapierRigidBody | null>;
  hubRef: RefObject<RapierRigidBody | null>;
}

export function Cable({ carriageRef, hubRef }: CableProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const carriage = carriageRef.current;
    const hub = hubRef.current;
    const mesh = meshRef.current;
    if (!carriage || !hub || !mesh) return;

    const top = carriage.translation();
    const bottom = hub.translation();
    const length = Math.max(0.02, top.y - bottom.y);

    mesh.position.set(bottom.x, (top.y + bottom.y) / 2, bottom.z);
    mesh.scale.set(1, length, 1);
  });

  return (
    <mesh ref={meshRef} castShadow>
      <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
      <meshStandardMaterial color="#2c2f36" roughness={0.9} />
    </mesh>
  );
}
