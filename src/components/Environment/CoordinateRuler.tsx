/**
 * Coordinate ruler on the floor and walls (control styles 2 and 3) so the
 * (X, Z) value — picked on the Direct-move panel, or by the AI reading the
 * captured images — can be read off the cabinet. X ticks run cyan along the
 * back wall, Z ticks run orange along the left wall, each row ending in a big
 * "X" / "Z" so the axis is unambiguous. Rendered twice (see Cabinet): once at
 * the floor and once above the bridge rods, since the rods hide the
 * floor-level grid while the claw is positioning overhead.
 */

import { Text } from "@react-three/drei";
import type { GameConfig } from "../../config/gameConfig";

const TICK_STEP = 0.5;
const LINE_THICKNESS = 0.01;
const X_COLOR = "#5ad1ff";
const Z_COLOR = "#ffb648";
/** Labels sit a little above their grid plane so they read at eye level. */
const LABEL_LIFT = 0.4;

function ticks(min: number, max: number, step: number): number[] {
  const start = Math.ceil(min / step - 1e-6) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-6; v += step) {
    out.push(Math.round(v / step) * step);
  }
  return out;
}

interface CoordinateRulerProps {
  config: GameConfig;
  /** Height of this ruler's grid plane. */
  y: number;
}

export function CoordinateRuler({ config, y }: CoordinateRulerProps) {
  const { floor } = config;
  const [minX, maxX, minZ, maxZ] = floor.bounds;
  const wallInset = 0.06;

  const xs = ticks(minX, maxX, TICK_STEP);
  const zs = ticks(minZ, maxZ, TICK_STEP);

  return (
    <group>
      {/* ---- grid ---- */}
      {xs.map((x) => (
        <mesh key={`grid-x-${x}`} position={[x, y, (minZ + maxZ) / 2]}>
          <boxGeometry args={[LINE_THICKNESS, 0.003, maxZ - minZ]} />
          <meshBasicMaterial color={X_COLOR} transparent opacity={0.4} />
        </mesh>
      ))}
      {zs.map((z) => (
        <mesh key={`grid-z-${z}`} position={[(minX + maxX) / 2, y, z]}>
          <boxGeometry args={[maxX - minX, 0.003, LINE_THICKNESS]} />
          <meshBasicMaterial color={Z_COLOR} transparent opacity={0.4} />
        </mesh>
      ))}

      {/* ---- back wall: X-axis labels, facing the camera at +Z ---- */}
      {xs.map((x) => (
        <Text
          key={`label-x-${x}`}
          position={[x, y + LABEL_LIFT, minZ + wallInset]}
          fontSize={0.1}
          color={X_COLOR}
          anchorX="center"
          anchorY="middle"
        >
          {x.toFixed(1)}
        </Text>
      ))}

      {/* ---- left side wall: Z-axis labels, facing +X into the cabinet ---- */}
      {zs.map((z) => (
        <Text
          key={`label-z-${z}`}
          position={[minX + wallInset, y + LABEL_LIFT, z]}
          rotation={[0, Math.PI / 2, 0]}
          fontSize={0.1}
          color={Z_COLOR}
          anchorX="center"
          anchorY="middle"
        >
          {z.toFixed(1)}
        </Text>
      ))}

      {/* ---- axis identifiers ---- */}
      <Text
        position={[maxX + 0.3, y + LABEL_LIFT, minZ + wallInset]}
        fontSize={0.2}
        color={X_COLOR}
        anchorX="center"
        anchorY="middle"
      >
        X
      </Text>
      <Text
        position={[minX + wallInset, y + LABEL_LIFT, maxZ + 0.3]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.2}
        color={Z_COLOR}
        anchorX="center"
        anchorY="middle"
      >
        Z
      </Text>
    </group>
  );
}
