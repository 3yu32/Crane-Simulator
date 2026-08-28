import { describe, expect, it } from "vitest";
import { isPrizeCollected, pointInGoal, type GoalVolume } from "./prizeDetection";

const goal: GoalVolume = {
  center: [-1.35, 0.35, -1.0],
  halfExtents: [0.5, 0.75, 0.5],
};

describe("pointInGoal", () => {
  it("accepts a point at the goal center", () => {
    expect(pointInGoal({ x: -1.35, y: 0.35, z: -1.0 }, goal)).toBe(true);
  });

  it("accepts a point just inside the edge", () => {
    expect(pointInGoal({ x: -0.9, y: 0.35, z: -1.0 }, goal)).toBe(true);
  });

  it("rejects a point outside on X", () => {
    expect(pointInGoal({ x: 0.2, y: 0.35, z: -1.0 }, goal)).toBe(false);
  });

  it("rejects the prize resting on the rods", () => {
    expect(isPrizeCollected({ x: 0.2, y: 1.43, z: 0.15 }, goal)).toBe(false);
  });

  it("detects the prize falling through the chute", () => {
    expect(isPrizeCollected({ x: -1.35, y: 0.2, z: -1.0 }, goal)).toBe(true);
  });
});
