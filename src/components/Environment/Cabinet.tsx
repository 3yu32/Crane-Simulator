/**
 * Static cabinet: a solid floor (the whole floor is the prize goal — see
 * gameConfig.goal), containment walls, and a decorative frame. All colliders
 * are fixed bodies.
 */

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { GameConfig } from "../../config/gameConfig";
import { useGameState } from "../../game/gameStore";
import { CoordinateRuler } from "./CoordinateRuler";

interface CabinetProps {
  config: GameConfig;
}

const FLOOR_THICKNESS = 0.2;
const WALL_HEIGHT = 3.8;
const WALL_THICKNESS = 0.1;

export function Cabinet({ config }: CabinetProps) {
  const controlStyle = useGameState((s) => s.controlStyle);
  const { floor } = config;
  const [minX, maxX, minZ, maxZ] = floor.bounds;
  const top = floor.y;
  const midY = top - FLOOR_THICKNESS / 2;

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const wallY = top + WALL_HEIGHT / 2;

  return (
    <group>
      {/* ---- solid floor ---- */}
      <RigidBody
        type="fixed"
        colliders={false}
        friction={floor.friction}
        restitution={floor.restitution}
      >
        <CuboidCollider
          args={[spanX / 2, FLOOR_THICKNESS / 2, spanZ / 2]}
          position={[cx, midY, cz]}
          friction={floor.friction}
          restitution={floor.restitution}
        />
      </RigidBody>
      <mesh position={[cx, midY, cz]} receiveShadow>
        <boxGeometry args={[spanX, FLOOR_THICKNESS, spanZ]} />
        <meshStandardMaterial color="#31353f" roughness={0.95} />
      </mesh>

      {/* ---- containment walls ---- */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[spanX / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]}
          position={[cx, wallY, minZ - WALL_THICKNESS / 2]}
        />
        <CuboidCollider
          args={[spanX / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]}
          position={[cx, wallY, maxZ + WALL_THICKNESS / 2]}
        />
        <CuboidCollider
          args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, spanZ / 2]}
          position={[minX - WALL_THICKNESS / 2, wallY, cz]}
        />
        <CuboidCollider
          args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, spanZ / 2]}
          position={[maxX + WALL_THICKNESS / 2, wallY, cz]}
        />
      </RigidBody>

      {/* far wall (visual) */}
      <mesh position={[cx, wallY, minZ]} receiveShadow>
        <boxGeometry args={[spanX, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#1b1f27" roughness={0.7} />
      </mesh>
      {/* side walls (visual, semi-transparent glass) */}
      <mesh position={[minX, wallY, cz]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, spanZ]} />
        <meshStandardMaterial color="#223042" transparent opacity={0.18} />
      </mesh>
      <mesh position={[maxX, wallY, cz]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, spanZ]} />
        <meshStandardMaterial color="#223042" transparent opacity={0.18} />
      </mesh>

      {/* decorative top frame */}
      <mesh position={[cx, top + WALL_HEIGHT, cz]}>
        <boxGeometry args={[spanX + 0.12, 0.14, spanZ + 0.12]} />
        <meshStandardMaterial color="#e24a67" roughness={0.5} />
      </mesh>

      {controlStyle === "direct" && (
        <>
          <CoordinateRuler config={config} y={floor.y + 0.006} />
          <CoordinateRuler config={config} y={config.bridge.rodHeight + 0.5} />
        </>
      )}
    </group>
  );
}
