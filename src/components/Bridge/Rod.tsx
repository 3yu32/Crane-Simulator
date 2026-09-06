/**
 * A single bridge rod: a kinematic-position cylinder rigid body with an
 * explicit cylinder collider (spec §6). Rotated 90° about Z so the local +Y
 * cylinder axis points along world +X (the rods run left-to-right). Kinematic
 * so the bridge can be repositioned (height / spacing) by dragging without
 * rebuilding the bodies.
 *
 * The rod's look tracks its friction: near-white polished steel at 0, through
 * pink, to a matte deep-pink "rubber" as friction approaches ROD_FRICTION_MAX.
 */

import { forwardRef, useMemo } from "react";
import {
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Color, MathUtils } from "three";
import { ROD_FRICTION_MAX } from "../../game/gameStore";

interface RodProps {
  position: [number, number, number];
  radius: number;
  length: number;
  friction: number;
  restitution: number;
}

const LOW = new Color("#e9edf3"); // polished steel / near-white
const MID = new Color("#ff9ec6"); // pink
const HIGH = new Color("#d81b8c"); // deep pink

function rodAppearance(friction: number): {
  color: Color;
  roughness: number;
  metalness: number;
} {
  const t = MathUtils.clamp(friction / ROD_FRICTION_MAX, 0, 1);
  const color = new Color();
  if (t < 0.5) color.lerpColors(LOW, MID, t / 0.5);
  else color.lerpColors(MID, HIGH, (t - 0.5) / 0.5);
  return {
    color,
    roughness: MathUtils.lerp(0.3, 0.65, t),
    metalness: MathUtils.lerp(0.7, 0.15, t),
  };
}

export const Rod = forwardRef<RapierRigidBody, RodProps>(function Rod(
  { position, radius, length, friction, restitution },
  ref,
) {
  const look = useMemo(() => rodAppearance(friction), [friction]);

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
        <meshStandardMaterial
          color={look.color}
          roughness={look.roughness}
          metalness={look.metalness}
        />
      </mesh>
    </RigidBody>
  );
});
