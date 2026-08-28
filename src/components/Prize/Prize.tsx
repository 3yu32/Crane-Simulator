/**
 * The prize: a tall cuboid as a dynamic rigid body with a cuboid collider
 * (spec §7). Rotation is never locked; CCD is on to avoid tunnelling through
 * the rods or claws on fast contacts.
 */

import { useEffect, type RefObject } from "react";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Quaternion, Euler } from "three";
import type { GameConfig } from "../../config/gameConfig";
import { getState } from "../../game/gameStore";

interface PrizeProps {
  config: GameConfig;
  prizeRef: RefObject<RapierRigidBody | null>;
  /** The controller stores the imperative reset callback here. */
  resetPrizeRef: RefObject<(() => void) | null>;
}

export function Prize({ config, prizeRef, resetPrizeRef }: PrizeProps) {
  const { prize, physics } = config;
  const [w, h, d] = [prize.width, prize.height, prize.depth];
  const [px, py, pz] = prize.position;
  const [rx, ry, rz] = prize.rotation;

  useEffect(() => {
    resetPrizeRef.current = () => {
      const body = prizeRef.current;
      if (!body) return;
      // Drop the prize just above the highest current rod so it lands on the
      // bridge even after the rods have been dragged.
      const rods = getState().bridgeControls.rods;
      const maxRodY = rods.reduce((m, r) => Math.max(m, r.y), 0);
      const y = maxRodY + h / 2 + config.bridge.rodRadius + 0.06;
      body.setTranslation({ x: px, y, z: pz }, true);
      const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz));
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };
    return () => {
      resetPrizeRef.current = null;
    };
  }, [prizeRef, resetPrizeRef, px, py, pz, rx, ry, rz, h, config.bridge.rodRadius]);

  return (
    <RigidBody
      ref={prizeRef}
      type="dynamic"
      colliders="cuboid"
      position={[px, py, pz]}
      rotation={[rx, ry, rz]}
      mass={prize.mass}
      friction={prize.friction}
      restitution={prize.restitution}
      linearDamping={prize.linearDamping}
      angularDamping={prize.angularDamping}
      ccd={physics.ccd}
      canSleep={false}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8607d" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* lid seam, purely decorative */}
      <mesh position={[0, h / 2 - h * 0.18, 0]}>
        <boxGeometry args={[w * 1.02, h * 0.02, d * 1.02]} />
        <meshStandardMaterial color="#b64963" roughness={0.6} />
      </mesh>
    </RigidBody>
  );
}
