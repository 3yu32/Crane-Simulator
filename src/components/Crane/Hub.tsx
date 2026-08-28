/**
 * The claw hub: a dynamic body that hangs from the carriage on the simulated
 * cable (a Y-axis prismatic joint with a position motor — see CraneRig). The
 * two prongs are jointed to this body. Its rotation is locked so it stays
 * upright; only the winch moves it vertically.
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
  const hubHalfX = Math.max(0.14, config.claw.pivotSpan / 2 + 0.05);

  return (
    <RigidBody
      ref={ref}
      type="dynamic"
      colliders={false}
      collisionGroups={CRANE_GROUPS}
      position={[crane.homeX, crane.homeY, crane.homeZ]}
      mass={crane.hubMass}
      enabledRotations={[false, false, false]}
      linearDamping={0.6}
      ccd={config.physics.ccd}
      canSleep={false}
    >
      <CuboidCollider args={[hubHalfX, 0.06, 0.1]} position={[0, 0, 0]} />
      <mesh castShadow>
        <boxGeometry args={[hubHalfX * 2, 0.12, 0.2]} />
        <meshStandardMaterial color="#9aa1b0" metalness={0.5} roughness={0.4} />
      </mesh>
    </RigidBody>
  );
});
