/**
 * Visual hint for the goal volume (spec §27) — now the whole cabinet floor.
 * Only drawn while the debug collider view is on; acquisition is decided by
 * {@link isPrizeCollected} in the controller.
 */

import { useGameState } from "../../game/gameStore";
import type { GameConfig } from "../../config/gameConfig";

export function GoalMarker({ config }: { config: GameConfig }) {
  const showColliders = useGameState((s) => s.showColliders);
  if (!showColliders) return null;

  const { center, halfExtents } = config.goal;
  return (
    <mesh position={center}>
      <boxGeometry
        args={[halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2]}
      />
      <meshBasicMaterial
        color="#43d17a"
        transparent
        opacity={0.12}
        depthWrite={false}
      />
    </mesh>
  );
}
