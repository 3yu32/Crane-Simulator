/**
 * The prize: a tall cuboid as a dynamic rigid body with one explicit
 * cuboid collider — a single plain box, no lid/seam trim.
 *
 * Draggable in the 3D view for manual placement/testing: plain drag moves it
 * (screen-horizontal maps to world X when viewed through the front camera,
 * or world Z when viewed through the side camera — whichever axis actually
 * runs left-right for that camera; screen-vertical always maps to height).
 * A modifier + drag rotates it instead — one axis per gesture, from
 * horizontal drag:
 *   - Ctrl          → yaw   (turn about the vertical / height axis)
 *   - Shift         → pitch (tip forward / back, about the 左右 axis)
 *   - Ctrl + Shift  → roll  (bank sideways, about the 奥行き / depth axis)
 * Both move and rotate temporarily drive the body directly and zero its
 * velocities each move so physics doesn't fight the drag; releasing hands
 * it straight back to gravity/collisions — and records where it was left as
 * the new spawn pose (`prizeSpawn`), which RESET restores.
 */

import { useEffect, type RefObject } from "react";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import { Euler, Quaternion, Vector3 } from "three";
import type { GameConfig } from "../../config/gameConfig";
import { getState, setPrizeSpawn, useGameState } from "../../game/gameStore";
import { draggingThroughSideCamera } from "../../game/viewportCamera";

interface PrizeProps {
  config: GameConfig;
  prizeRef: RefObject<RapierRigidBody | null>;
  /** The controller stores the imperative reset callback here. */
  resetPrizeRef: RefObject<(() => void) | null>;
}

const DRAG_SCALE = 0.008;
const ROTATE_SCALE = 0.012;
// Vertical drag clamp, in world Y (= our height axis Z).
const HEIGHT_MIN = 0.3;
const HEIGHT_MAX = 3.2;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function Prize({ config, prizeRef, resetPrizeRef }: PrizeProps) {
  const { prize, physics, floor } = config;
  const spawn = useGameState((s) => s.prizeSpawn);

  const [w, h, d] = [prize.width, prize.height, prize.depth];
  const [sx, sy, sz] = spawn.position;
  const [srx, sry, srz] = spawn.rotation;

  useEffect(() => {
    resetPrizeRef.current = () => {
      const body = prizeRef.current;
      if (!body) return;

      // Restore the saved spawn pose (default = config.prize.position).
      const { position, rotation } = getState().prizeSpawn;
      body.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true,
      );
      const q = new Quaternion().setFromEuler(
        new Euler(rotation[0], rotation[1], rotation[2]),
      );
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };

    return () => {
      resetPrizeRef.current = null;
    };
  }, [prizeRef, resetPrizeRef]);

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const body = prizeRef.current;
    if (!body) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPos = body.translation();
    const startRot = body.rotation();
    const usingSideCam = draggingThroughSideCamera(startClientX, startClientY);
    const [minX, maxX, minZ, maxZ] = floor.bounds;

    const move = (ev: PointerEvent) => {
      const b = prizeRef.current;
      if (!b) return;
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;

      if (ev.ctrlKey || ev.shiftKey) {
        // Rotate mode: one world axis per gesture, from horizontal drag,
        // composed onto the pose the drag started from.
        //   Ctrl        → yaw   (world Y, our height)
        //   Shift       → pitch (world X, our 左右)
        //   Ctrl+Shift  → roll  (world Z, our 奥行き)
        const turn = dx * ROTATE_SCALE;
        const axis =
          ev.ctrlKey && ev.shiftKey
            ? new Vector3(0, 0, 1)
            : ev.ctrlKey
              ? new Vector3(0, 1, 0)
              : new Vector3(1, 0, 0);
        const q = new Quaternion(
          startRot.x,
          startRot.y,
          startRot.z,
          startRot.w,
        ).premultiply(new Quaternion().setFromAxisAngle(axis, turn));
        b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        b.setTranslation(startPos, true);
      } else {
        // Front camera's screen-right is world +X; the side camera looks
        // back along −X, so its screen-right is world −Z instead.
        const x = usingSideCam
          ? startPos.x
          : clamp(startPos.x + dx * DRAG_SCALE, minX, maxX);
        const z = usingSideCam
          ? clamp(startPos.z - dx * DRAG_SCALE, minZ, maxZ)
          : startPos.z;
        const y = clamp(startPos.y - dy * DRAG_SCALE, HEIGHT_MIN, HEIGHT_MAX);
        b.setTranslation({ x, y, z }, true);
      }
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      // Remember where it was left as the new spawn pose (so RESET / a saved
      // preset can put it back here).
      const b = prizeRef.current;
      if (b) {
        const p = b.translation();
        const r = b.rotation();
        const e = new Euler().setFromQuaternion(
          new Quaternion(r.x, r.y, r.z, r.w),
        );
        setPrizeSpawn({
          position: [p.x, p.y, p.z],
          rotation: [e.x, e.y, e.z],
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "grabbing";
  };

  return (
    <RigidBody
      ref={prizeRef}
      type="dynamic"
      // IMPORTANT:
      // Automatic mesh-based colliders are disabled.
      colliders={false}
      position={[sx, sy, sz]}
      rotation={[srx, sry, srz]}
      mass={prize.mass}
      linearDamping={prize.linearDamping}
      angularDamping={prize.angularDamping}
      // Keep CCD enabled according to physics config.
      ccd={physics.ccd}
      canSleep={false}
    >
      {/* =========================================================
          PHYSICS
          Exactly one collider for the physical prize box.
          CuboidCollider args are HALF extents.
          ========================================================= */}
      <CuboidCollider args={[w / 2, h / 2, d / 2]} friction={prize.friction} restitution={prize.restitution} />

      {/* =========================================================
          VISUAL BODY — also the drag/rotate handle.
          ========================================================= */}
      <mesh
        castShadow
        receiveShadow
        onPointerDown={startDrag}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8607d" roughness={0.55} metalness={0.05} />
      </mesh>
    </RigidBody>
  );
}
