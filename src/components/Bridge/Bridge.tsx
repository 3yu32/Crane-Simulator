/**
 * The "bridge": a player-adjustable set of parallel rods (spec §6) running
 * along X (wall to wall). Each rod is kinematic and independently draggable
 * in the 3D view — vertical drag changes that rod's height, horizontal drag
 * moves it along Z (depth) — and independently carries its own friction and
 * can be added or removed from the on-screen Bridge panel.
 */

import { useRef } from "react";
import { useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import type { GameConfig } from "../../config/gameConfig";
import { getState, setRodPlacement, useGameState } from "../../game/gameStore";
import { SIDE_VIEW_RECT } from "../../game/viewportCamera";
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

/**
 * The side camera looks back along world −X, so its screen-right is world
 * −Z — the opposite of the front camera's. Horizontal drag is authored
 * against the front camera's sense of "right"; when the pointer that started
 * the drag was actually looking through the side camera (the enlarged side
 * view, or the inset before it's swapped in), flip the Z delta so dragging
 * still moves the rod the way it visually appears to move for that camera.
 */
function draggingThroughSideCamera(clientX: number, clientY: number): boolean {
  const { left, top, width, height } = SIDE_VIEW_RECT;
  const inInset =
    clientX >= left &&
    clientX <= left + width &&
    clientY >= top &&
    clientY <= top + height;
  const swapped = getState().sideViewSwapped;
  return inInset ? !swapped : swapped;
}

export function Bridge({ config }: BridgeProps) {
  const { bridge } = config;
  const refsById = useRef(new Map<string, RapierRigidBody | null>());
  const rods = useGameState((s) => s.bridgeControls.rods);

  useBeforePhysicsStep(() => {
    for (const r of getState().bridgeControls.rods) {
      refsById.current.get(r.id)?.setNextKinematicTranslation({ x: 0, y: r.y, z: r.z });
    }
  });

  const startDrag = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const rod = getState().bridgeControls.rods.find((r) => r.id === id);
    if (!rod) return;
    const { y, z } = rod;
    const zSign = draggingThroughSideCamera(startX, startY) ? -1 : 1;

    const move = (ev: PointerEvent) => {
      setRodPlacement(id, {
        y: clamp(y - (ev.clientY - startY) * DRAG_SCALE, HEIGHT_MIN, HEIGHT_MAX),
        z: clamp(z + zSign * (ev.clientX - startX) * DRAG_SCALE, Z_MIN, Z_MAX),
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
            position={[0, rod.y, rod.z]}
            radius={bridge.rodRadius}
            length={bridge.rodLength}
            friction={rod.friction}
            restitution={bridge.restitution}
          />
          {/* invisible per-rod drag handle */}
          <mesh
            position={[0, rod.y, rod.z]}
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
