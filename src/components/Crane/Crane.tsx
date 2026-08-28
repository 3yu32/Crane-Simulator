/**
 * The crane rig (spec §8): a kinematic carriage up top, a dynamic claw hub
 * hanging from it on a simulated cable, the cable visual, and the two-prong
 * claw assembly jointed to the hub.
 *
 * The cable constraint itself (a Y-axis prismatic joint whose position motor is
 * the winch) is created in `GameScene`'s World so the controller can drive it.
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
  /** Remount key for the claw assembly (collider props that need a rebuild). */
  clawKey: string;
}

export function Crane({
  config,
  carriageRef,
  hubRef,
  clawOpenRef,
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
        hubPosition={[crane.homeX, crane.homeY, crane.homeZ]}
      />
    </>
  );
}
