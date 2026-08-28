/**
 * Prize acquisition detection (spec §27). Kept as a standalone, side-effect-free
 * module so the rule is easy to test and swap.
 */

import type { Vec3 } from "../config/gameConfig";

export interface GoalVolume {
  center: Vec3;
  halfExtents: Vec3;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** True when a point lies inside the axis-aligned goal box. */
export function pointInGoal(point: Vector3Like, goal: GoalVolume): boolean {
  const [cx, cy, cz] = goal.center;
  const [hx, hy, hz] = goal.halfExtents;
  return (
    Math.abs(point.x - cx) <= hx &&
    Math.abs(point.y - cy) <= hy &&
    Math.abs(point.z - cz) <= hz
  );
}

/**
 * True when the prize is considered collected: its center of mass has entered
 * the goal volume (the chute below the home position).
 */
export function isPrizeCollected(
  prizeCenter: Vector3Like,
  goal: GoalVolume,
): boolean {
  return pointInGoal(prizeCenter, goal);
}
