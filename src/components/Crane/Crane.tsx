/**
 * The crane rig (spec §8): a kinematic carriage up top, the kinematic claw hub
 * hanging below it (the winch pays it out / in), the cable visual, and the
 * two-prong claw assembly jointed to the hub.
 */

import type { RefObject } from "react";
import type { RapierRigidBody } from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";
import { Carriage } from "./Carriage";
import { Hub } from "./Hub";
import { Cable } from "./Cable";
import { ClawAssembly } from "./ClawAssembly";

interface CraneProps {
  config: GameConfig;
  carriageRef: RefObject<RapierRigidBody | null>;
  hubRef: RefObject<RapierRigidBody | null>;
  clawOpenRef: RefObject<boolean>;
  contactForceRef: RefObject<number>;
  /** Remount key for the claw assembly (collider props that need a rebuild). */
  clawKey: string;
}

export function Crane({
  config,
  carriageRef,
  hubRef,
  clawOpenRef,
  contactForceRef,
  clawKey,
}: CraneProps) {
  const { crane } = config;
  return (
    <>
      <Carriage ref={carriageRef} config={config} />
      <Hub ref={hubRef} config={config} />
      <Cable carriageRef={carriageRef} hubRef={hubRef} />
      <ClawAssembly
        key={clawKey}
        config={config}
        hubRef={hubRef}
        clawOpenRef={clawOpenRef}
        contactForceRef={contactForceRef}
        hubPosition={[crane.homeX, crane.homeY, crane.homeZ]}
      />
    </>
  );
}
