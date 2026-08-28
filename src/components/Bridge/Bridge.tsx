/**
 * The "bridge": `rodCount` parallel rods (spec §6). Here the rods run along X
 * (wall to wall) and are spaced along Z, centred on the configured point. The
 * prize rests across the middle pair and can fall through the gap between them.
 */

import type { GameConfig } from "../../config/gameConfig";
import { Rod } from "./Rod";

interface BridgeProps {
  config: GameConfig;
}

export function Bridge({ config }: BridgeProps) {
  const { bridge } = config;
  const first = -((bridge.rodCount - 1) / 2) * bridge.rodSpacing;

  return (
    <group>
      {Array.from({ length: bridge.rodCount }, (_, i) => (
        <Rod
          key={i}
          position={[
            0,
            bridge.rodHeight,
            bridge.rodCenterZ + first + i * bridge.rodSpacing,
          ]}
          radius={bridge.rodRadius}
          length={bridge.rodLength}
          friction={bridge.friction}
          restitution={bridge.restitution}
        />
      ))}
    </group>
  );
}
