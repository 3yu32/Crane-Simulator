/**
 * The "bridge": a player-adjustable set of parallel rods (spec §6) running
 * along X (wall to wall). Each rod is kinematic and independently draggable
 * in the 3D view — vertical drag changes that rod's height (Z), horizontal
 * drag moves it along depth (Y) — and independently carries its own friction
 * and can be added or removed from the on-screen Bridge panel.
 *
 * RodPlacement.y = depth, RodPlacement.z = height. Three.js world:
 * world.y ← rod.z (height), world.z ← rod.y (depth).
 */

import { useRef } from "react";
import { useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import type { GameConfig } from "../../config/gameConfig";
import { getState, setRodPlacement, useGameState } from "../../game/gameStore";
import { draggingThroughSideCamera } from "../../game/viewportCamera";
import { Rod } from "./Rod";

interface BridgeProps {
  config: GameConfig;
}

const HEIGHT_MIN = 0.45;
const HEIGHT_MAX = 2.6;
const DEPTH_MIN = -1.5;
const DEPTH_MAX = 1.5;
/** World units per screen pixel, roughly, for the head-on play camera. */
const DRAG_SCALE = 0.008;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function Bridge({ config }: BridgeProps) {
  const { bridge } = config;
  const refsById = useRef(new Map<string, RapierRigidBody | null>());
  const rods = useGameState((s) => s.bridgeControls.rods);

  useBeforePhysicsStep(() => {
    for (const r of getState().bridgeControls.rods) {
      refsById.current.get(r.id)?.setNextKinematicTranslation({ x: 0, y: r.z, z: r.y });
    }
  });

  const startDrag = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const rod = getState().bridgeControls.rods.find((r) => r.id === id);
    if (!rod) return;
    const { y: depth, z: height } = rod;
    const depthSign = draggingThroughSideCamera(startX, startY) ? -1 : 1;

    const move = (ev: PointerEvent) => {
      setRodPlacement(id, {
        z: clamp(height - (ev.clientY - startY) * DRAG_SCALE, HEIGHT_MIN, HEIGHT_MAX),
        y: clamp(
          depth + depthSign * (ev.clientX - startX) * DRAG_SCALE,
          DEPTH_MIN,
          DEPTH_MAX,
        ),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "grabbing";
  };

  return (
    <group>
      {rods.map((rod) => (
        <group key={rod.id}>
          <Rod
            ref={(el) => {
              refsById.current.set(rod.id, el);
            }}
            position={[0, rod.z, rod.y]}
            radius={bridge.rodRadius}
            length={bridge.rodLength}
            friction={rod.friction}
            restitution={bridge.restitution}
          />
          {/* invisible per-rod drag handle */}
          <mesh
            position={[0, rod.z, rod.y]}
            onPointerDown={(e) => startDrag(rod.id, e)}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "grab";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <boxGeometry args={[bridge.rodLength, 0.34, 0.32]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
