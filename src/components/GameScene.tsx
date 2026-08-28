/**
 * Top-level 3D scene: camera, lights, physics world and all bodies (spec §28).
 * Rendering / physics / input / state are kept in separate modules; this file
 * only wires them together.
 */

import { useEffect, useRef, useMemo, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Physics, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { Vector3 } from "three";
import type { GameConfig } from "../config/gameConfig";
import { useDebugConfig } from "../game/useDebugConfig";
import { useGameState } from "../game/gameStore";
import { useCraneController } from "../game/useCraneController";
import { Bridge } from "./Bridge/Bridge";
import { Prize } from "./Prize/Prize";
import { Crane } from "./Crane/Crane";
import { ClawAssembly } from "./Crane/ClawAssembly";
import { Cabinet } from "./Environment/Cabinet";
import { GoalMarker } from "./Environment/GoalMarker";

function PlayCamera({ config }: { config: GameConfig }) {
  const orbit = useGameState((s) => s.orbit);
  const camera = useThree((s) => s.camera);
  const target = useMemo(
    () => new Vector3(...config.camera.target),
    [config.camera.target],
  );

  // Fixed play camera (spec §22): snap to the configured pose whenever orbit is
  // off. OrbitControls takes over while debugging.
  useEffect(() => {
    if (orbit) return;
    camera.position.set(...config.camera.position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [orbit, camera, config.camera.position, target]);

  if (!orbit) return null;
  return <OrbitControls target={target} makeDefault />;
}

/**
 * Dev-only helper: browsers pause requestAnimationFrame for hidden/background
 * tabs, which freezes the R3F + physics loop. When running the dev server we
 * top up the loop from a timer so the scene keeps simulating for inspection /
 * screenshots. Compiled out of production builds.
 */
function HiddenTabPump() {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      if (document.hidden) {
        last = performance.now();
        advance(last);
      }
    }, 1000 / 30);
    return () => window.clearInterval(id);
  }, [advance]);
  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={1.7} />
      <hemisphereLight args={["#dfe6ff", "#3a3a44", 0.9]} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={3.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-0.5, 3, 3]} intensity={12} distance={12} decay={2} />
    </>
  );
}

/**
 * Dev-only: exposes a synchronous fixed-step driver on `window.__sim` so the
 * simulation can be advanced for inspection even when the tab is throttled and
 * requestAnimationFrame is paused. Compiled out of production.
 */
function SimTestHarness() {
  const rapier = useRapier();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __sim: Record<string, unknown> };
    w.__sim = {
      step: (n = 1) => {
        for (let i = 0; i < n; i++) rapier.step(1 / 60);
      },
      ctx: rapier,
      world: rapier.world,
    };
    return () => {
      delete (window as unknown as { __sim?: unknown }).__sim;
    };
  }, [rapier]);
  return null;
}

/** Everything that lives inside the physics world. */
function World({ config }: { config: GameConfig }) {
  const craneRef = useRef<RapierRigidBody>(null);
  const prizeRef = useRef<RapierRigidBody>(null);
  const clawOpenRef = useRef<boolean>(true);
  const resetPrizeRef: RefObject<(() => void) | null> = useRef(null);

  useCraneController(
    { craneRef, prizeRef, clawOpenRef, resetPrizeRef },
    config,
  );

  const { crane } = config;
  const hubPosition: [number, number, number] = [
    crane.homeX,
    crane.homeY,
    crane.homeZ,
  ];

  // Re-mount bodies whose collider shape / mass properties changed in the GUI.
  const prizeKey = `${config.prize.width}|${config.prize.height}|${config.prize.depth}|${config.prize.mass}|${config.prize.friction}`;
  const bridgeKey = `${config.bridge.rodGap}|${config.bridge.friction}`;
  const clawKey = `${config.claw.friction}|${config.claw.armLength}|${config.claw.armThickness}|${config.claw.tipLength}`;

  return (
    <>
      <SimTestHarness />
      <Cabinet config={config} />
      <Bridge key={bridgeKey} config={config} />
      <Prize
        key={prizeKey}
        config={config}
        prizeRef={prizeRef}
        resetPrizeRef={resetPrizeRef}
      />
      <Crane ref={craneRef} config={config} />
      <ClawAssembly
        key={clawKey}
        config={config}
        craneRef={craneRef}
        clawOpenRef={clawOpenRef}
        hubPosition={hubPosition}
      />
      <GoalMarker config={config} />
    </>
  );
}

export function GameScene() {
  const config = useDebugConfig();
  const showColliders = useGameState((s) => s.showColliders);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{
        position: config.camera.position,
        fov: config.camera.fov,
        near: 0.1,
        far: 100,
      }}
      onCreated={(state) => {
        if (import.meta.env.DEV) {
          (window as unknown as { __r3f: unknown }).__r3f = state;
        }
      }}
    >
      <color attach="background" args={["#0d0f14"]} />
      <HiddenTabPump />
      <PlayCamera config={config} />
      <Lights />
      <Physics
        timeStep={config.physics.timeStep}
        numSolverIterations={config.physics.numSolverIterations}
        numInternalPgsIterations={config.physics.numInternalPgsIterations}
        gravity={[0, config.gravity, 0]}
        interpolate
        debug={showColliders}
      >
        <World config={config} />
      </Physics>
    </Canvas>
  );
}
