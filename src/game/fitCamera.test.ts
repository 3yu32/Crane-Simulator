import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fittedDistance, placeCamera } from "./fitCamera";

describe("fitCamera", () => {
  it("never moves the camera on wide screens", () => {
    expect(fittedDistance(8.82, 44, 16 / 9)).toBe(8.82);
    expect(fittedDistance(8.82, 44, 2.2)).toBe(8.82);
    expect(fittedDistance(8.4, 40, 16 / 9)).toBe(8.4);
  });

  it("backs off on a tall phone screen so the cabinet width fits", () => {
    const d = fittedDistance(8.82, 44, 375 / 812);
    expect(d).toBeGreaterThan(14);
    // the nearest cabinet face (2 closer than the target) must fit the half-width
    const halfVisible = (d - 2) * Math.tan((44 * Math.PI) / 360) * (375 / 812);
    expect(halfVisible).toBeGreaterThanOrEqual(2.5 - 1e-6);
  });

  it("places along the view line, re-fits when something else moves the camera, and clears the lift on wide screens", () => {
    const cam = new PerspectiveCamera(44, 0.46, 0.1, 100);
    const base = new Vector3(0, 3.5, 8.6);
    const target = new Vector3(0, 1.55, 0);

    placeCamera(cam, base, target, 0.46);
    expect(cam.position.distanceTo(target)).toBeGreaterThan(14);
    expect(cam.view?.enabled).toBe(true);

    cam.position.copy(base); // e.g. a pose effect resetting it
    placeCamera(cam, base, target, 0.46);
    expect(cam.position.distanceTo(target)).toBeGreaterThan(14);

    placeCamera(cam, base, target, 16 / 9);
    expect(cam.position.distanceTo(base)).toBeLessThan(1e-6);
    expect(cam.view?.enabled ?? false).toBe(false);
  });
});
