/**
 * The "bridge": `rodCount` parallel rods (spec §6) running along X (wall to
 * wall). Each rod is kinematic and independently draggable in the 3D view —
 * vertical drag changes that rod's height, horizontal drag moves it along Z
 * (depth). Orientation never changes and the spacing need not stay even.
 */

import { useRef } from "react";
import { useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import { gameConfig, type GameConfig } from "../../config/gameConfig";
import { getState, setRodPlacement, useGameState } from "../../game/gameStore";
import { Rod } from "./Rod";

interface BridgeProps {
  config: GameConfig;
}

const HEIGHT_MIN = 0.45;
const HEIGHT_MAX = 2.6;
const Z_MIN = -1.5;
const Z_MAX = 1.5;
/** World units per screen pixel, roughly, for the head-on play camera. */
const DRAG_SCALE = 0.008;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Initial (mount) Z for rod i, evenly spaced from the config defaults. */
function initialZ(i: number): number {
  const { rodCount, rodSpacing, rodCenterZ } = gameConfig.bridge;
  return rodCenterZ - ((rodCount - 1) / 2) * rodSpacing + i * rodSpacing;
}

export function Bridge({ config }: BridgeProps) {
  const { bridge } = config;
  const refs = useRef<(RapierRigidBody | null)[]>([]);
  const rods = useGameState((s) => s.bridgeControls.rods);

  useBeforePhysicsStep(() => {
    const rs = getState().bridgeControls.rods;
    for (let i = 0; i < bridge.rodCount; i++) {
      const r = rs[i];
      if (r) {
        refs.current[i]?.setNextKinematicTranslation({ x: 0, y: r.y, z: r.z });
      }
    }
  });

  const startDrag = (index: number, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const { y, z } = getState().bridgeControls.rods[index];

    const move = (ev: PointerEvent) => {
      setRodPlacement(index, {
        y: clamp(y - (ev.clientY - startY) * DRAG_SCALE, HEIGHT_MIN, HEIGHT_MAX),
        z: clamp(z + (ev.clientX - startX) * DRAG_SCALE, Z_MIN, Z_MAX),
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
      {Array.from({ length: bridge.rodCount }, (_, i) => {
        const rod = rods[i] ?? { y: gameConfig.bridge.rodHeight, z: initialZ(i) };
        return (
          <group key={i}>
            <Rod
              ref={(el) => {
                refs.current[i] = el;
              }}
              position={[0, gameConfig.bridge.rodHeight, initialZ(i)]}
              radius={bridge.rodRadius}
              length={bridge.rodLength}
              friction={bridge.friction}
              restitution={bridge.restitution}
            />
            {/* invisible per-rod drag handle */}
            <mesh
              position={[0, rod.y, rod.z]}
              onPointerDown={(e) => startDrag(i, e)}
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
        );
      })}
    </group>
  );
}
