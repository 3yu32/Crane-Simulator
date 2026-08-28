/**
 * Bridges the Leva debug GUI (spec §20) with the immutable {@link gameConfig}.
 *
 * When the debug panel is closed the base config is returned untouched. When it
 * is open, the tunable subset is overlaid with the live GUI values and the
 * resulting config flows down to every component. Bodies whose shape/mass
 * depend on these values are re-mounted via keys derived from the config.
 */

import { useEffect, useMemo } from "react";
import { folder, useControls } from "leva";
import { gameConfig, type GameConfig } from "../config/gameConfig";
import {
  setOrbit,
  setShowColliders,
  useGameState,
} from "./gameStore";

export function useDebugConfig(): GameConfig {
  const debug = useGameState((s) => s.debug);

  const values = useControls(
    {
      Helpers: folder({
        showColliders: { value: false, label: "Show Physics Colliders" },
        orbit: { value: false, label: "Orbit Camera" },
      }),
      Prize: folder({
        prizeMass: { value: gameConfig.prize.mass, min: 0.05, max: 3, step: 0.05 },
        prizeFriction: {
          value: gameConfig.prize.friction,
          min: 0,
          max: 2,
          step: 0.05,
        },
        prizeWidth: {
          value: gameConfig.prize.width,
          min: 0.15,
          max: 0.6,
          step: 0.01,
        },
        prizeHeight: {
          value: gameConfig.prize.height,
          min: 0.2,
          max: 1.0,
          step: 0.01,
        },
        prizeDepth: {
          value: gameConfig.prize.depth,
          min: 0.15,
          max: 0.6,
          step: 0.01,
        },
      }),
      Bridge: folder({
        rodGap: {
          value: gameConfig.bridge.rodGap,
          min: 0.1,
          max: 0.6,
          step: 0.005,
        },
        rodFriction: {
          value: gameConfig.bridge.friction,
          min: 0,
          max: 2,
          step: 0.05,
        },
      }),
      Claw: folder({
        openAngle: {
          value: gameConfig.claw.openAngle,
          min: 0.1,
          max: 1.0,
          step: 0.01,
        },
        closedAngle: {
          value: gameConfig.claw.closedAngle,
          min: -0.2,
          max: 0.8,
          step: 0.01,
        },
        motorStrength: {
          value: gameConfig.claw.motorStiffness,
          min: 10,
          max: 600,
          step: 5,
        },
        clawFriction: {
          value: gameConfig.claw.friction,
          min: 0,
          max: 3,
          step: 0.05,
        },
      }),
      Crane: folder({
        xSpeed: { value: gameConfig.crane.xSpeed, min: 0.2, max: 3, step: 0.05 },
        zSpeed: { value: gameConfig.crane.zSpeed, min: 0.2, max: 3, step: 0.05 },
        descentSpeed: {
          value: gameConfig.crane.descentSpeed,
          min: 0.2,
          max: 2,
          step: 0.05,
        },
      }),
    },
    { collapsed: false },
  );

  useEffect(() => {
    setShowColliders(debug && values.showColliders);
  }, [debug, values.showColliders]);

  useEffect(() => {
    setOrbit(debug && values.orbit);
  }, [debug, values.orbit]);

  return useMemo<GameConfig>(() => {
    if (!debug) return gameConfig;
    return {
      ...gameConfig,
      prize: {
        ...gameConfig.prize,
        mass: values.prizeMass,
        friction: values.prizeFriction,
        width: values.prizeWidth,
        height: values.prizeHeight,
        depth: values.prizeDepth,
      },
      bridge: {
        ...gameConfig.bridge,
        rodGap: values.rodGap,
        friction: values.rodFriction,
      },
      claw: {
        ...gameConfig.claw,
        openAngle: values.openAngle,
        closedAngle: values.closedAngle,
        motorStiffness: values.motorStrength,
        friction: values.clawFriction,
      },
      crane: {
        ...gameConfig.crane,
        xSpeed: values.xSpeed,
        zSpeed: values.zSpeed,
        descentSpeed: values.descentSpeed,
      },
    };
  }, [
    debug,
    values.prizeMass,
    values.prizeFriction,
    values.prizeWidth,
    values.prizeHeight,
    values.prizeDepth,
    values.rodGap,
    values.rodFriction,
    values.openAngle,
    values.closedAngle,
    values.motorStrength,
    values.clawFriction,
    values.xSpeed,
    values.zSpeed,
    values.descentSpeed,
  ]);
}
