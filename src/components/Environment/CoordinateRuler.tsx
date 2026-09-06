/**
 * Coordinate ruler on the floor and walls (control styles 2 and 3) so the
 * (X, Y) value — picked on the Direct-move panel, or by the AI reading the
 * captured images — can be read off the cabinet. X ticks run cyan along the
 * back wall, Y (depth) ticks run orange along the left wall, each row ending
 * in a big "X" / "Y" so the axis is unambiguous. Rendered twice (see
 * Cabinet): once at the floor and once above the bridge rods, since the rods
 * hide the floor-level grid while the claw is positioning overhead.
 *
 * Works in Three.js world space: `worldY` is the grid plane's world Y (= our
 * height Z); the orange ticks run along world Z (= our depth Y).
 */

import { Text } from "@react-three/drei";
import type { GameConfig } from "../../config/gameConfig";

const TICK_STEP = 0.5;
const LINE_THICKNESS = 0.01;
const X_COLOR = "#5ad1ff";
const Y_COLOR = "#ffb648";
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
  /** World Y of this ruler's grid plane. */
  worldY: number;
}

export function CoordinateRuler({ config, worldY }: CoordinateRulerProps) {
  const { floor } = config;
  // bounds[2],[3] are our depth Y = world Z.
  const [minX, maxX, minDepth, maxDepth] = floor.bounds;
  const wallInset = 0.06;

  const xs = ticks(minX, maxX, TICK_STEP);
  const ys = ticks(minDepth, maxDepth, TICK_STEP);

  return (
    <group>
      {/* ---- grid ---- */}
      {xs.map((x) => (
        <mesh key={`grid-x-${x}`} position={[x, worldY, (minDepth + maxDepth) / 2]}>
          <boxGeometry args={[LINE_THICKNESS, 0.003, maxDepth - minDepth]} />
          <meshBasicMaterial color={X_COLOR} transparent opacity={0.4} />
        </mesh>
      ))}
      {ys.map((yv) => (
        <mesh key={`grid-y-${yv}`} position={[(minX + maxX) / 2, worldY, yv]}>
          <boxGeometry args={[maxX - minX, 0.003, LINE_THICKNESS]} />
          <meshBasicMaterial color={Y_COLOR} transparent opacity={0.4} />
        </mesh>
      ))}

      {/* ---- back wall: X-axis labels, facing the camera at +Z ---- */}
      {xs.map((x) => (
        <Text
          key={`label-x-${x}`}
          position={[x, worldY + LABEL_LIFT, minDepth + wallInset]}
          fontSize={0.1}
          color={X_COLOR}
          anchorX="center"
          anchorY="middle"
        >
          {x.toFixed(1)}
        </Text>
      ))}

      {/* ---- left side wall: Y (depth) labels, facing +X into the cabinet ---- */}
      {ys.map((yv) => (
        <Text
          key={`label-y-${yv}`}
          position={[minX + wallInset, worldY + LABEL_LIFT, yv]}
          rotation={[0, Math.PI / 2, 0]}
          fontSize={0.1}
          color={Y_COLOR}
          anchorX="center"
          anchorY="middle"
        >
          {yv.toFixed(1)}
        </Text>
      ))}

      {/* ---- axis identifiers ---- */}
      <Text
        position={[maxX + 0.3, worldY + LABEL_LIFT, minDepth + wallInset]}
        fontSize={0.2}
        color={X_COLOR}
        anchorX="center"
        anchorY="middle"
      >
        X
      </Text>
      <Text
        position={[minX + wallInset, worldY + LABEL_LIFT, maxDepth + 0.3]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.2}
        color={Y_COLOR}
        anchorX="center"
        anchorY="middle"
      >
        Y
      </Text>
    </group>
  );
}
