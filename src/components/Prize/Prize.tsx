/**
 * The prize: a tall cuboid as a dynamic rigid body with one explicit
 * cuboid collider — a single plain box, no lid/seam trim.
 */

import { useEffect, type RefObject } from "react";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Quaternion, Euler } from "three";
import type { GameConfig } from "../../config/gameConfig";
import { getState } from "../../game/gameStore";

interface PrizeProps {
  config: GameConfig;
  prizeRef: RefObject<RapierRigidBody | null>;
  /** The controller stores the imperative reset callback here. */
  resetPrizeRef: RefObject<(() => void) | null>;
}

export function Prize({
  config,
  prizeRef,
  resetPrizeRef,
}: PrizeProps) {
  const { prize, physics } = config;

  const [w, h, d] = [
    prize.width,
    prize.height,
    prize.depth,
  ];

  const [px, py, pz] = prize.position;
  const [rx, ry, rz] = prize.rotation;

  useEffect(() => {
    resetPrizeRef.current = () => {
      const body = prizeRef.current;
      if (!body) return;

      // Drop the prize just above the highest current rod.
      const rods = getState().bridgeControls.rods;

      const maxRodY = rods.reduce(
        (max, rod) => Math.max(max, rod.y),
        0,
      );

      const y =
        maxRodY +
        h / 2 +
        config.bridge.rodRadius +
        0.06;

      body.setTranslation(
        {
          x: px,
          y,
          z: pz,
        },
        true,
      );

      const q = new Quaternion().setFromEuler(
        new Euler(rx, ry, rz),
      );

      body.setRotation(
        {
          x: q.x,
          y: q.y,
          z: q.z,
          w: q.w,
        },
        true,
      );

      body.setLinvel(
        {
          x: 0,
          y: 0,
          z: 0,
        },
        true,
      );

      body.setAngvel(
        {
          x: 0,
          y: 0,
          z: 0,
        },
        true,
      );
    };

    return () => {
      resetPrizeRef.current = null;
    };
  }, [
    prizeRef,
    resetPrizeRef,
    px,
    py,
    pz,
    rx,
    ry,
    rz,
    h,
    config.bridge.rodRadius,
  ]);

  return (
    <RigidBody
      ref={prizeRef}
      type="dynamic"

      // IMPORTANT:
      // Automatic mesh-based colliders are disabled.
      colliders={false}

      position={[px, py, pz]}
      rotation={[rx, ry, rz]}

      mass={prize.mass}

      linearDamping={prize.linearDamping}
      angularDamping={prize.angularDamping}

      // Keep CCD enabled according to physics config.
      ccd={physics.ccd}

      canSleep={false}
    >
      {/* =========================================================
          PHYSICS
          Exactly one collider for the physical prize box.
          CuboidCollider args are HALF extents.
          ========================================================= */}
      <CuboidCollider
        args={[
          w / 2,
          h / 2,
          d / 2,
        ]}
        friction={prize.friction}
        restitution={prize.restitution}
      />

      {/* =========================================================
          VISUAL BODY
          ========================================================= */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />

        <meshStandardMaterial
          color="#e8607d"
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>
    </RigidBody>
  );
}