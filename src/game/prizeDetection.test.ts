import { describe, expect, it } from "vitest";
import { isPrizeCollected, pointInGoal, type GoalVolume } from "./prizeDetection";

// The goal is a thin slab covering the whole cabinet floor.
const goal: GoalVolume = {
  center: [0, 0.2, 0],
  halfExtents: [1.95, 0.42, 1.95],
};

describe("pointInGoal", () => {
  it("accepts a point at the goal centre", () => {
    expect(pointInGoal({ x: 0, y: 0.2, z: 0 }, goal)).toBe(true);
  });

  it("accepts a point just inside the edge", () => {
    expect(pointInGoal({ x: 1.9, y: 0.2, z: -1.9 }, goal)).toBe(true);
  });

  it("rejects a point outside the cabinet in X", () => {
    expect(pointInGoal({ x: 2.5, y: 0.2, z: 0 }, goal)).toBe(false);
  });

  it("rejects a point too high (still up on the bridge)", () => {
    expect(pointInGoal({ x: 0, y: 1.0, z: 0 }, goal)).toBe(false);
  });
});

describe("isPrizeCollected", () => {
  it("does not count the prize resting on the rods", () => {
    expect(isPrizeCollected({ x: 0.15, y: 1.38, z: -0.1 }, goal)).toBe(false);
  });

  it("counts the prize once it lands on the floor", () => {
    expect(isPrizeCollected({ x: 0.6, y: 0.29, z: 0.8 }, goal)).toBe(true);
  });

  it("counts the prize anywhere on the floor", () => {
    expect(isPrizeCollected({ x: -1.7, y: 0.29, z: 1.7 }, goal)).toBe(true);
    expect(isPrizeCollected({ x: 1.7, y: 0.29, z: -1.7 }, goal)).toBe(true);
  });
});
