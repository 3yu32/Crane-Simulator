/**
 * The trolley/carriage at the top of the cabinet (spec §8). Kinematic-position
 * body: the cabinet's X/Y motors drive it directly (spec §3). Its height (Z)
 * is fixed — vertical motion happens on the cable below it.
 */

import { forwardRef } from "react";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";
import { CRANE_GROUPS } from "../../physics/collisionGroups";

interface CarriageProps {
  config: GameConfig;
}

export const Carriage = forwardRef<RapierRigidBody, CarriageProps>(
  function Carriage({ config }, ref) {
    const { crane } = config;
    return (
      <RigidBody
        ref={ref}
        type="kinematicPosition"
        colliders={false}
        collisionGroups={CRANE_GROUPS}
        position={[crane.homeX, crane.carriageZ, crane.homeY]}
      >
        <CuboidCollider args={[0.28, 0.06, 0.24]} position={[0, 0, 0]} />
        <mesh castShadow>
          <boxGeometry args={[0.56, 0.12, 0.48]} />
          <meshStandardMaterial color="#aab0be" metalness={0.4} roughness={0.45} />
        </mesh>
        {/* winch drum */}
        <mesh position={[0, -0.11, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 16]} />
          <meshStandardMaterial color="#6f7684" metalness={0.7} roughness={0.35} />
        </mesh>
      </RigidBody>
    );
  },
);
