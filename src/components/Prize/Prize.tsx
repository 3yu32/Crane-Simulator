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
 *
 * Centre of mass: the box carries an explicit mass/inertia (the collider
 * itself contributes none). `prize.comOffset` places the resting CoM inside
 * the box, and `prize.comShift` lets it slide toward the low side as the box
 * tilts (loose contents) — always clamped to stay inside the box. With the
 * `showCom` visualiser on, the box turns translucent and the live CoM shows
 * as a blue dot.
 */

import { useEffect, useRef, type RefObject } from "react";
import {
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { ThreeEvent } from "@react-three/fiber";
import { Euler, Mesh, Quaternion, Vector3 } from "three";
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
/** Keep the CoM within this fraction of each half-extent — never outside the box. */
const COM_MARGIN = 0.9;
/** The collider contributes no mass; the body's mass/inertia is set explicitly. */
const ZERO_COLLIDER_MASS = {
  mass: 0,
  centerOfMass: { x: 0, y: 0, z: 0 },
  principalAngularInertia: { x: 0, y: 0, z: 0 },
  angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
};
const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 };
const G_DOWN = new Vector3(0, -1, 0);
const _gLocal = new Vector3();
const _qInv = new Quaternion();
/** Latest box-local CoM written by `writeMassProps`, for the visualiser dot. */
const _com = new Vector3();

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Write the box's mass, inertia and current centre of mass onto the body.
 * The CoM = resting offset + a gravity-driven slide toward the low side,
 * clamped to stay inside the box.
 */
function writeMassProps(
  body: RapierRigidBody,
  w: number,
  h: number,
  d: number,
  mass: number,
  comOx: number,
  comOy: number,
  comOz: number,
  comShift: number,
): void {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const r = body.rotation();
  _qInv.set(r.x, r.y, r.z, r.w).invert();
  _gLocal.copy(G_DOWN).applyQuaternion(_qInv); // gravity direction, box-local
  const cx = clamp(comOx * hw + comShift * hw * _gLocal.x, -hw * COM_MARGIN, hw * COM_MARGIN);
  const cy = clamp(comOy * hh + comShift * hh * _gLocal.y, -hh * COM_MARGIN, hh * COM_MARGIN);
  const cz = clamp(comOz * hd + comShift * hd * _gLocal.z, -hd * COM_MARGIN, hd * COM_MARGIN);
  _com.set(cx, cy, cz);
  body.setAdditionalMassProperties(
    mass,
    { x: cx, y: cy, z: cz },
    {
      x: Math.max(1e-4, (mass / 12) * (h * h + d * d)),
      y: Math.max(1e-4, (mass / 12) * (w * w + d * d)),
      z: Math.max(1e-4, (mass / 12) * (w * w + h * h)),
    },
    IDENTITY_ROT,
    false,
  );
}

export function Prize({ config, prizeRef, resetPrizeRef }: PrizeProps) {
  const { prize, physics, floor } = config;
  const spawn = useGameState((s) => s.prizeSpawn);
  const showCom = useGameState((s) => s.showCom);
  const comDotRef = useRef<Mesh>(null);

  const [w, h, d] = [prize.width, prize.height, prize.depth];
  const [comOx, comOy, comOz] = prize.comOffset;
  const { comShift, mass } = prize;
  const [sx, sy, sz] = spawn.position;
  const [srx, sry, srz] = spawn.rotation;

  // Seed the mass properties on mount / when they change (before the first
  // physics step); the per-step hook then tracks the gravity-driven slide.
  useEffect(() => {
    const body = prizeRef.current;
    if (body) writeMassProps(body, w, h, d, mass, comOx, comOy, comOz, comShift);
  }, [prizeRef, w, h, d, mass, comOx, comOy, comOz, comShift]);

  useBeforePhysicsStep(() => {
    const body = prizeRef.current;
    if (!body) return;
    writeMassProps(body, w, h, d, mass, comOx, comOy, comOz, comShift);
    comDotRef.current?.position.copy(_com);
  });

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
      <CuboidCollider
        args={[w / 2, h / 2, d / 2]}
        friction={prize.friction}
        restitution={prize.restitution}
        massProperties={ZERO_COLLIDER_MASS}
      />

      {/* =========================================================
          VISUAL BODY — also the drag/rotate handle. Goes translucent
          in the CoM visualiser so the blue dot inside is visible.
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
        {/* keyed so toggling `transparent` rebuilds the material (a runtime
            flip alone doesn't recompile the shader). */}
        <meshStandardMaterial
          key={showCom ? "translucent" : "solid"}
          color="#e8607d"
          roughness={0.55}
          metalness={0.05}
          transparent={showCom}
          opacity={showCom ? 0.28 : 1}
          depthWrite={!showCom}
        />
      </mesh>

      {/* centre-of-mass marker (visualiser only) */}
      {showCom && (
        <mesh ref={comDotRef} renderOrder={10}>
          <sphereGeometry args={[Math.min(w, h, d) * 0.11, 20, 20]} />
          <meshBasicMaterial color="#2f6bff" depthTest={false} toneMapped={false} />
        </mesh>
      )}
    </RigidBody>
  );
}
