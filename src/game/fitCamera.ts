/**
 * Keep the whole cabinet in frame on any screen shape. The play cameras are
 * authored for a wide (landscape) canvas; on a tall phone screen the narrow
 * horizontal field of view would cut the cabinet off at the sides, so the
 * camera backs away along its view direction just far enough to fit the
 * cabinet's width. Wide screens never move (the base distance already fits).
 */

import { Vector3, type PerspectiveCamera } from "three";

/** Half the cabinet's visible width (walls + frame) plus a little margin. */
const CABINET_HALF_WIDTH = 2.5;
/** The nearest cabinet face is this much closer to the camera than the target. */
const NEAR_OFFSET = 2;

const _dir = new Vector3();
const _pos = new Vector3();

/** Distance from the target needed to fit the cabinet width at `aspect`. */
export function fittedDistance(baseDist: number, vFovDeg: number, aspect: number): number {
  const t = Math.tan((vFovDeg * Math.PI) / 360);
  return Math.max(baseDist, CABINET_HALF_WIDTH / (t * aspect) + NEAR_OFFSET);
}

/**
 * On a tall (portrait) screen the bottom controls cover the lower part of the
 * canvas, so slide the rendered image up by a fraction of the screen height to
 * lift the cabinet into the clear area. A view-offset shifts the image without
 * changing perspective. Zero for aspect >= 1, so wide screens are untouched.
 */
function portraitLiftFraction(aspect: number): number {
  const tall = Math.min(Math.max(1 - aspect, 0), 0.6);
  return tall * 0.3;
}

/** Place `cam` on the line target→basePos, backed off as far as `aspect` needs. */
export function placeCamera(
  cam: PerspectiveCamera,
  basePos: Vector3,
  target: Vector3,
  aspect: number,
): void {
  _dir.copy(basePos).sub(target);
  const dist = fittedDistance(_dir.length(), cam.fov, aspect);
  _pos.copy(target).addScaledVector(_dir.normalize(), dist);

  // Re-apply when the aspect changed, or when something else (e.g. the
  // PlayCamera pose effect) moved the camera off its fitted spot.
  const key = aspect.toFixed(3);
  const moved = cam.position.distanceToSquared(_pos) > 1e-8;
  if (cam.userData.fitKey === key && !moved) return;
  cam.userData.fitKey = key;

  cam.position.copy(_pos);
  cam.lookAt(target);
  cam.updateMatrixWorld();

  const lift = portraitLiftFraction(aspect);
  if (lift > 0) {
    // y > 0 slides the sampled window down, i.e. the image up.
    cam.setViewOffset(1000 * aspect, 1000, 0, lift * 1000, 1000 * aspect, 1000);
  } else {
    cam.clearViewOffset();
  }
}
