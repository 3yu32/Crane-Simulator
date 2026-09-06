/**
 * Support for two on-screen viewports (the main view and the SideView inset,
 * see components/SideView.tsx) sharing one canvas and one R3F event system.
 *
 * R3F's default pointer-event handling always raycasts with `state.camera` —
 * the Canvas's own default camera — using the whole canvas as the viewport.
 * That's wrong here: whichever of the two cameras is drawn *big* (the main
 * area) should be used for pointer events there, and the other camera should
 * be used over the *inset* rect, regardless of which is which after a swap.
 * Without this, dragging a bridge rod while the side view is enlarged (or
 * even just hovering the small inset) raycasts along the wrong camera's ray,
 * so the grabbed point doesn't match what's on screen.
 */

import type { PerspectiveCamera } from "three";
import { getState } from "./gameStore";

/** Inset placement in CSS pixels (must match `.side-view-frame` in App.css). */
export const SIDE_VIEW_RECT = { left: 14, top: 362, width: 232, height: 124 };

/**
 * SideView owns and updates this camera every frame; the Canvas `events`
 * compute below only needs to read it to pick the right camera for a given
 * pointer event.
 */
export const sideCameraRef: { current: PerspectiveCamera | null } = {
  current: null,
};

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __sideCamera: unknown }).__sideCamera = sideCameraRef;
}

interface ComputeState {
  pointer: { set: (x: number, y: number) => void };
  raycaster: { setFromCamera: (pointer: unknown, cam: unknown) => void };
  camera: unknown;
  size: { width: number; height: number };
}

/** Custom R3F events `compute`: pick the camera/viewport under the pointer. */
export function computeViewportEvent(
  event: { offsetX: number; offsetY: number },
  state: ComputeState,
): void {
  const sideCam = sideCameraRef.current;
  const mainCam = state.camera;
  const ox = event.offsetX;
  const oy = event.offsetY;

  if (!sideCam) {
    state.pointer.set(
      (ox / state.size.width) * 2 - 1,
      -(oy / state.size.height) * 2 + 1,
    );
    state.raycaster.setFromCamera(state.pointer, mainCam);
    return;
  }

  const { left, top, width, height } = SIDE_VIEW_RECT;
  const inInset = ox >= left && ox <= left + width && oy >= top && oy <= top + height;
  const swapped = getState().sideViewSwapped;

  let cam: unknown;
  let vx: number, vy: number, vw: number, vh: number;
  if (inInset) {
    cam = swapped ? mainCam : sideCam;
    vx = left;
    vy = top;
    vw = width;
    vh = height;
  } else {
    cam = swapped ? sideCam : mainCam;
    vx = 0;
    vy = 0;
    vw = state.size.width;
    vh = state.size.height;
  }

  state.pointer.set(((ox - vx) / vw) * 2 - 1, -(((oy - vy) / vh) * 2 - 1));
  state.raycaster.setFromCamera(state.pointer, cam);
}

/**
 * Which camera a drag that started at (clientX, clientY) is being viewed
 * through: the side camera looks back along world −X, so its screen-right is
 * world −Z (the opposite of the front camera's screen-right, which is world
 * +X). Drag math authored against the front camera needs to flip/retarget
 * for drags that started over the side camera's viewport — whichever one
 * that is, main area or inset, depending on the current swap state.
 */
export function draggingThroughSideCamera(clientX: number, clientY: number): boolean {
  const { left, top, width, height } = SIDE_VIEW_RECT;
  const inInset =
    clientX >= left &&
    clientX <= left + width &&
    clientY >= top &&
    clientY <= top + height;
  const swapped = getState().sideViewSwapped;
  return inInset ? !swapped : swapped;
}
