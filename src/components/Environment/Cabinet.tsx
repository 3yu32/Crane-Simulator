/**
 * Static cabinet: floor (with an open chute in one corner), containment walls,
 * a catch bin under the chute, and a decorative frame. All colliders are fixed
 * bodies.
 *
 * The chute is assumed to sit against the -X / +Z corner of the play area, so
 * the solid floor is two rectangles: a full-depth strip on the +X side of the
 * chute, and a partial strip filling the rest of the -X side.
 */

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";

interface CabinetProps {
  config: GameConfig;
}

const FLOOR_THICKNESS = 0.2;
const WALL_HEIGHT = 3.8;
const WALL_THICKNESS = 0.1;
const CATCH_DEPTH = 1.3;

export function Cabinet({ config }: CabinetProps) {
  const { floor } = config;
  const [minX, maxX, minZ, maxZ] = floor.bounds;
  const [, chuteMaxX, chuteMinZ] = floor.chute;
  const top = floor.y;
  const midY = top - FLOOR_THICKNESS / 2;

  // Piece A: +X of the chute, full depth.
  const aW = maxX - chuteMaxX;
  const aCX = chuteMaxX + aW / 2;
  const aCZ = (minZ + maxZ) / 2;
  const aDepth = maxZ - minZ;

  // Piece B: -X strip, only the part that is not the chute.
  const bW = chuteMaxX - minX;
  const bCX = minX + bW / 2;
  const bDepth = chuteMinZ - minZ;
  const bCZ = minZ + bDepth / 2;

  const wallY = top + WALL_HEIGHT / 2;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  // Catch bin: a walled box directly under the chute footprint.
  const chuteW = chuteMaxX - minX;
  const chuteD = maxZ - chuteMinZ;
  const binCX = minX + chuteW / 2;
  const binCZ = chuteMinZ + chuteD / 2;
  const binFloorY = top - CATCH_DEPTH;
  const binWallH = CATCH_DEPTH + 0.2;
  const binWallY = binFloorY + binWallH / 2;

  return (
    <group>
      {/* ---- floor ---- */}
      <RigidBody
        type="fixed"
        colliders={false}
        friction={floor.friction}
        restitution={floor.restitution}
      >
        <CuboidCollider
          args={[aW / 2, FLOOR_THICKNESS / 2, aDepth / 2]}
          position={[aCX, midY, aCZ]}
          friction={floor.friction}
          restitution={floor.restitution}
        />
        <CuboidCollider
          args={[bW / 2, FLOOR_THICKNESS / 2, bDepth / 2]}
          position={[bCX, midY, bCZ]}
          friction={floor.friction}
          restitution={floor.restitution}
        />
      </RigidBody>
      <mesh position={[aCX, midY, aCZ]} receiveShadow>
        <boxGeometry args={[aW, FLOOR_THICKNESS, aDepth]} />
        <meshStandardMaterial color="#31353f" roughness={0.95} />
      </mesh>
      <mesh position={[bCX, midY, bCZ]} receiveShadow>
        <boxGeometry args={[bW, FLOOR_THICKNESS, bDepth]} />
        <meshStandardMaterial color="#31353f" roughness={0.95} />
      </mesh>

      {/* ---- containment walls: back (opaque, far side) + sides + front ---- */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[spanX / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]}
          position={[(minX + maxX) / 2, wallY, minZ - WALL_THICKNESS / 2]}
        />
        <CuboidCollider
          args={[spanX / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]}
          position={[(minX + maxX) / 2, wallY, maxZ + WALL_THICKNESS / 2]}
        />
        <CuboidCollider
          args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, spanZ / 2]}
          position={[minX - WALL_THICKNESS / 2, wallY, (minZ + maxZ) / 2]}
        />
        <CuboidCollider
          args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, spanZ / 2]}
          position={[maxX + WALL_THICKNESS / 2, wallY, (minZ + maxZ) / 2]}
        />
      </RigidBody>

      {/* far wall (visual) */}
      <mesh position={[(minX + maxX) / 2, wallY, minZ]} receiveShadow>
        <boxGeometry args={[spanX, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#1b1f27" roughness={0.7} />
      </mesh>
      {/* side walls (visual, semi-transparent glass) */}
      <mesh position={[minX, wallY, (minZ + maxZ) / 2]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, spanZ]} />
        <meshStandardMaterial color="#223042" transparent opacity={0.18} />
      </mesh>
      <mesh position={[maxX, wallY, (minZ + maxZ) / 2]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, spanZ]} />
        <meshStandardMaterial color="#223042" transparent opacity={0.18} />
      </mesh>

      {/* ---- catch bin under the chute (floored + walled so the prize stays) ---- */}
      <RigidBody type="fixed" colliders={false} friction={0.95}>
        <CuboidCollider
          args={[chuteW / 2 + 0.05, 0.08, chuteD / 2 + 0.05]}
          position={[binCX, binFloorY, binCZ]}
        />
        <CuboidCollider
          args={[0.05, binWallH / 2, chuteD / 2]}
          position={[minX + 0.05, binWallY, binCZ]}
        />
        <CuboidCollider
          args={[0.05, binWallH / 2, chuteD / 2]}
          position={[chuteMaxX - 0.05, binWallY, binCZ]}
        />
        <CuboidCollider
          args={[chuteW / 2, binWallH / 2, 0.05]}
          position={[binCX, binWallY, chuteMinZ + 0.05]}
        />
        <CuboidCollider
          args={[chuteW / 2, binWallH / 2, 0.05]}
          position={[binCX, binWallY, maxZ - 0.05]}
        />
      </RigidBody>
      <mesh position={[binCX, binFloorY, binCZ]} receiveShadow>
        <boxGeometry args={[chuteW, 0.1, chuteD]} />
        <meshStandardMaterial color="#14161c" roughness={1} />
      </mesh>

      {/* ---- decorative top frame ---- */}
      <mesh position={[(minX + maxX) / 2, top + WALL_HEIGHT, (minZ + maxZ) / 2]}>
        <boxGeometry args={[spanX + 0.12, 0.14, spanZ + 0.12]} />
        <meshStandardMaterial color="#e24a67" roughness={0.5} />
      </mesh>
    </group>
  );
}
