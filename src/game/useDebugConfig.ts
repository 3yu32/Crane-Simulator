/**
 * Builds the effective {@link GameConfig} from three layers:
 *
 *  1. the immutable {@link gameConfig} defaults
 *  2. the always-on-screen Arm controls (`store.armControls`) — arm power,
 *     descent limit and descent stop force are player-adjustable during play
 *  3. the Leva debug GUI (spec §20), applied only while debug mode is on
 *
 * The resulting config flows down to every component. Bodies whose shape/mass
 * depend on these values are re-mounted via keys derived from the config.
 */

import { useEffect, useMemo } from "react";
import { folder, useControls } from "leva";
import { gameConfig, type GameConfig } from "../config/gameConfig";
import {
  ROD_FRICTION_MAX,
  setOrbit,
  setShowColliders,
  useGameState,
} from "./gameStore";

export function useDebugConfig(): GameConfig {
  const debug = useGameState((s) => s.debug);
  const armControls = useGameState((s) => s.armControls);
  const craneBounds = useGameState((s) => s.craneBounds);
  const prizeControls = useGameState((s) => s.prizeControls);

  const values = useControls(
    {
      Helpers: folder({
        showColliders: { value: false, label: "Show Physics Colliders" },
        orbit: { value: false, label: "Orbit Camera" },
      }),
      Prize: folder({
        // width / height / depth are on the on-screen PRIZE panel.
        prizeMass: { value: gameConfig.prize.mass, min: 0.05, max: 3, step: 0.05 },
        prizeFriction: {
          value: gameConfig.prize.friction,
          min: 0,
          max: 2,
          step: 0.05,
        },
      }),
      Bridge: folder({
        // rod height / depth / friction are per-rod, adjustable in the
        // Bridge panel and by dragging in the 3D view. This is only the
        // default friction given to a newly added rod.
        rodFriction: {
          value: gameConfig.bridge.friction,
          min: 0,
          max: ROD_FRICTION_MAX,
          step: 0.1,
          label: "新規バーの摩擦(初期値)",
        },
      }),
      Claw: folder({
        openAngle: {
          value: gameConfig.claw.openAngle,
          min: 0.05,
          max: 1.2,
          step: 0.01,
          label: "開き角 (open)",
        },
        closedAngle: {
          value: gameConfig.claw.closedAngle,
          min: -0.4,
          max: 0.8,
          step: 0.01,
          label: "閉じ角 (closed)",
        },
        openStiffness: {
          value: gameConfig.claw.openStiffness,
          min: 10,
          max: 400,
          step: 5,
          label: "開きモーター強度",
        },
        limitOpen: {
          value: gameConfig.claw.limitOpen,
          min: 0.1,
          max: 1.4,
          step: 0.01,
          label: "開き限界",
        },
        limitClose: {
          value: gameConfig.claw.limitClose,
          min: 0.1,
          max: 1.4,
          step: 0.01,
          label: "閉じ限界",
        },
        armLength: {
          value: gameConfig.claw.armLength,
          min: 0.25,
          max: 0.9,
          step: 0.01,
          label: "上段の腕の長さ",
        },
        lowerLength: {
          value: gameConfig.claw.lowerLength,
          min: 0.2,
          max: 0.7,
          step: 0.01,
          label: "下段の腕の長さ",
        },
        bendAngle: {
          value: gameConfig.claw.bendAngle,
          min: 0.2,
          max: 1.6,
          step: 0.01,
          label: "肘の曲げ角",
        },
        upperTilt: {
          value: gameConfig.claw.upperTilt,
          min: -0.4,
          max: 0.6,
          step: 0.01,
          label: "上段の傾き",
        },
        gripAngle: {
          value: gameConfig.claw.gripAngle,
          min: -0.8,
          max: 1.2,
          step: 0.01,
          label: "爪先の角度",
        },
        gripThickness: {
          value: gameConfig.claw.gripThickness,
          min: 0.008,
          max: 0.1,
          step: 0.002,
          label: "爪先の厚み",
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
        ySpeed: { value: gameConfig.crane.ySpeed, min: 0.2, max: 3, step: 0.05 },
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
    // Layer 2: always-applied ARM panel controls. (The bridge rods are placed
    // directly from the store by the Bridge component — not via config.)
    const baseWeight =
      (gameConfig.crane.hubMass + 2 * gameConfig.claw.mass) * -gameConfig.gravity;
    const weightFactor = armControls.armWeightN / baseWeight;

    const withArm: GameConfig = {
      ...gameConfig,
      claw: {
        ...gameConfig.claw,
        motorStiffness: armControls.armPower,
        mass: gameConfig.claw.mass * weightFactor,
      },
      crane: {
        ...gameConfig.crane,
        hubMass: gameConfig.crane.hubMass * weightFactor,
        lowestZ: armControls.descentLimitZ,
        descentTensionStop: armControls.descentTensionStop,
        pushDepth: armControls.pushDepthM,
        minX: craneBounds.minX,
        maxX: craneBounds.maxX,
        minY: craneBounds.minY,
        maxY: craneBounds.maxY,
        // Keep home inside the (possibly shrunk) travel range.
        homeX: Math.min(Math.max(gameConfig.crane.homeX, craneBounds.minX), craneBounds.maxX),
        homeY: Math.min(Math.max(gameConfig.crane.homeY, craneBounds.minY), craneBounds.maxY),
      },
      prize: {
        ...gameConfig.prize,
        width: prizeControls.width,
        height: prizeControls.height,
        depth: prizeControls.depth,
        comOffset: [prizeControls.comX, prizeControls.comY, prizeControls.comZ],
        comShift: prizeControls.comShift,
      },
    };

    if (!debug) return withArm;

    // Layer 3: Leva debug overrides.
    return {
      ...withArm,
      prize: {
        ...withArm.prize,
        mass: values.prizeMass,
        friction: values.prizeFriction,
      },
      bridge: {
        ...withArm.bridge,
        friction: values.rodFriction,
      },
      claw: {
        ...withArm.claw,
        openAngle: values.openAngle,
        closedAngle: values.closedAngle,
        openStiffness: values.openStiffness,
        limitOpen: values.limitOpen,
        limitClose: values.limitClose,
        armLength: values.armLength,
        lowerLength: values.lowerLength,
        bendAngle: values.bendAngle,
        upperTilt: values.upperTilt,
        gripAngle: values.gripAngle,
        gripThickness: values.gripThickness,
        friction: values.clawFriction,
      },
      crane: {
        ...withArm.crane,
        xSpeed: values.xSpeed,
        ySpeed: values.ySpeed,
        descentSpeed: values.descentSpeed,
      },
    };
  }, [
    debug,
    armControls.armPower,
    armControls.descentLimitZ,
    armControls.descentTensionStop,
    armControls.armWeightN,
    armControls.pushDepthM,
    craneBounds.minX,
    craneBounds.maxX,
    craneBounds.minY,
    craneBounds.maxY,
    prizeControls.width,
    prizeControls.height,
    prizeControls.depth,
    prizeControls.comX,
    prizeControls.comY,
    prizeControls.comZ,
    prizeControls.comShift,
    values.prizeMass,
    values.prizeFriction,
    values.rodFriction,
    values.openAngle,
    values.closedAngle,
    values.openStiffness,
    values.limitOpen,
    values.limitClose,
    values.armLength,
    values.lowerLength,
    values.bendAngle,
    values.upperTilt,
    values.gripAngle,
    values.gripThickness,
    values.clawFriction,
    values.xSpeed,
    values.ySpeed,
    values.descentSpeed,
  ]);
}
