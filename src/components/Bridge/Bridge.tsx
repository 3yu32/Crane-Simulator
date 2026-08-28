/**
 * The "bridge" pair of parallel rods the prize rests on (spec §6). Direction,
 * gap, radius and length are all configurable; here the rods run along +Z and
 * are separated along X, centred on the configured point.
 */

import type { GameConfig } from "../../config/gameConfig";
import { Rod } from "./Rod";

interface BridgeProps {
  config: GameConfig;
}

export function Bridge({ config }: BridgeProps) {
  const { bridge } = config;
  const halfGap = bridge.rodGap / 2;

  return (
    <group>
      <Rod
        position={[
          bridge.rodCenterX - halfGap,
          bridge.rodHeight,
          bridge.rodCenterZ,
        ]}
        radius={bridge.rodRadius}
        length={bridge.rodLength}
        friction={bridge.friction}
        restitution={bridge.restitution}
      />
      <Rod
        position={[
          bridge.rodCenterX + halfGap,
          bridge.rodHeight,
          bridge.rodCenterZ,
        ]}
        radius={bridge.rodRadius}
        length={bridge.rodLength}
        friction={bridge.friction}
        restitution={bridge.restitution}
      />
    </group>
  );
}
