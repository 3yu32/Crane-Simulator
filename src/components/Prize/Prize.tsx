/**
 * The prize: a tall cuboid as a dynamic rigid body with one explicit
 * cuboid collider — a single plain box, no lid/seam trim.
 *
 * Draggable in the 3D view for manual placement/testing: plain drag moves it
 * (screen-horizontal maps to world X when viewed through the front camera,
 * or world Z when viewed through the side camera — whichever axis actually
 * runs left-right for that camera; screen-vertical always maps to height).
 * Holding Ctrl while dragging rotates it instead (yaw from horizontal,
 * pitch from vertical). Both temporarily drive the body directly and zero
 * its velocities each move so physics doesn't fight the drag; releasing
 * hands it straight back to gravity/collisions.
 */

import { useEffect, type RefObject } from "react";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import { Euler, Quaternion } from "three";
import type { GameConfig } from "../../config/gameConfig";
import { getState } from "../../game/gameStore";
import { draggingThroughSideCamera } from "../../game/viewportCamera";

interface PrizeProps {
  config: GameConfig;
  prizeRef: RefObject<RapierRigidBody | null>;
  /** The controller stores the imperative reset callback here. */
  resetPrizeRef: RefObject<(() => void) | null>;
}

const DRAG_SCALE = 0.008;
const ROTATE_SCALE = 0.012;
const Y_MIN = 0.3;
const Y_MAX = 3.2;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function Prize({ config, prizeRef, resetPrizeRef }: PrizeProps) {
  const { prize, physics, floor } = config;

  const [w, h, d] = [prize.width, prize.height, prize.depth];

  const [px, py, pz] = prize.position;
  const [rx, ry, rz] = prize.rotation;

  useEffect(() => {
    resetPrizeRef.current = () => {
      const body = prizeRef.current;
      if (!body) return;

      // Drop the prize just above the highest current rod.
      const rods = getState().bridgeControls.rods;
      const maxRodY = rods.reduce((max, rod) => Math.max(max, rod.y), 0);
      const y = maxRodY + h / 2 + config.bridge.rodRadius + 0.06;

      body.setTranslation({ x: px, y, z: pz }, true);
      const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz));
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };

    return () => {
      resetPrizeRef.current = null;
    };
  }, [prizeRef, resetPrizeRef, px, py, pz, rx, ry, rz, h, config.bridge.rodRadius]);

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const body = prizeRef.current;
    if (!body) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPos = body.translation();
    const startRot = body.rotation();
    const startEuler = new Euler().setFromQuaternion(
      new Quaternion(startRot.x, startRot.y, startRot.z, startRot.w),
    );
    const usingSideCam = draggingThroughSideCamera(startClientX, startClientY);
    const [minX, maxX, minZ, maxZ] = floor.bounds;

    const move = (ev: PointerEvent) => {
      const b = prizeRef.current;
      if (!b) return;
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;

      if (ev.ctrlKey) {
        const q = new Quaternion().setFromEuler(
          new Euler(
            startEuler.x - dy * ROTATE_SCALE,
            startEuler.y + dx * ROTATE_SCALE,
            startEuler.z,
          ),
        );
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
        const y = clamp(startPos.y - dy * DRAG_SCALE, Y_MIN, Y_MAX);
        b.setTranslation({ x, y, z }, true);
      }
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
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
    <RigidBody
      ref={prizeRef}
      type="dynamic"
      // IMPORTANT:
      // Automatic mesh-based colliders are disabled.
      colliders={false}
      position={[px, py, pz]}
      rotation={[rx, ry, rz]}
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
