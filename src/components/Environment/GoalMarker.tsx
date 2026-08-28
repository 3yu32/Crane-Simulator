/**
 * Visual hint for the chute / goal volume (spec §27). No collider — acquisition
 * is decided by {@link isPrizeCollected} in the controller.
 */

import { useGameState } from "../../game/gameStore";
import type { GameConfig } from "../../config/gameConfig";

export function GoalMarker({ config }: { config: GameConfig }) {
  const showColliders = useGameState((s) => s.showColliders);
  const { center, halfExtents } = config.goal;

  return (
    <group position={center}>
      <mesh>
        <boxGeometry args={[halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2]} />
        <meshBasicMaterial
          color="#43d17a"
          transparent
          opacity={showColliders ? 0.18 : 0.06}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
