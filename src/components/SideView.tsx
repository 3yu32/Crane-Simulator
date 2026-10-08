/**
 * A second, always-on view of the same scene from the side (looking along −X).
 * One view fills the screen, the other is a small inset under the ARM panel;
 * clicking the inset (see App.tsx) swaps which is which.
 *
 * Implemented as an extra render pass: taking a render priority makes R3F yield
 * the render loop, so this callback draws the main camera and then the inset.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Vector3,
  type PerspectiveCamera as TPerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";
import type { GameConfig } from "../config/gameConfig";
import { placeCamera } from "../game/fitCamera";
import { getState } from "../game/gameStore";
import { SIDE_VIEW_RECT, syncSideViewRect, sideCameraRef } from "../game/viewportCamera";

function setAspect(cam: TPerspectiveCamera, aspect: number): void {
  if (cam.aspect === aspect) return;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
}

function renderInset(
  renderer: WebGLRenderer,
  scene: Scene,
  cam: TPerspectiveCamera,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.setScissorTest(true);
  renderer.autoClear = false;
  renderer.clearColor();
  renderer.clearDepth();
  renderer.render(scene, cam);
  renderer.autoClear = true;
  renderer.setScissorTest(false);
}

export function SideView({ config }: { config: GameConfig }) {
  const localCamRef = useRef<TPerspectiveCamera | null>(null);
  if (localCamRef.current === null) {
    localCamRef.current = new PerspectiveCamera(40, 1, 0.1, 100);
  }

  // Expose the camera to the shared module ref (read by the Canvas' events
  // `compute`) only from an effect — mutating it during render is not safe.
  useEffect(() => {
    sideCameraRef.current = localCamRef.current;
    return () => {
      sideCameraRef.current = null;
    };
  }, []);

  // Rod depth centre, which is world Z. The side camera's authored pose; the
  // frame loop backs it off further when the screen is too narrow to fit.
  const worldZ = config.bridge.rodCenterY;
  const sideBase = useMemo(() => new Vector3(8.4, 3.1, worldZ + 0.1), [worldZ]);
  const sideTarget = useMemo(() => new Vector3(0.15, 1.55, worldZ), [worldZ]);
  const frontBase = useMemo(() => new Vector3(...config.camera.position), [config.camera.position]);
  const frontTarget = useMemo(() => new Vector3(...config.camera.target), [config.camera.target]);

  useFrame((state) => {
    const sideCam = localCamRef.current;
    if (!sideCam) return;
    const gl = state.gl;
    const scene = state.scene;
    const camera = state.camera as TPerspectiveCamera;
    const size = state.size;

    const swapped = getState().sideViewSwapped;
    const mainCam = swapped ? sideCam : camera;
    const insetCam = swapped ? camera : sideCam;
    syncSideViewRect(gl.domElement);
    const { left, top, width, height } = SIDE_VIEW_RECT;

    // Each camera's aspect must match the rectangle it is drawn into, or the
    // image stretches — whichever camera lands in the small inset needs the
    // inset's aspect, not the full-screen one R3F keeps `camera` at.
    setAspect(mainCam, size.width / size.height);
    setAspect(insetCam, width / height);

    // Back each camera off if its current aspect would crop the cabinet
    // (tall phone screens). Orbit mode owns the front camera's pose.
    if (!getState().orbit) placeCamera(camera, frontBase, frontTarget, camera.aspect);
    placeCamera(sideCam, sideBase, sideTarget, sideCam.aspect);

    // main view — full frame
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.render(scene, mainCam);

    // inset — viewport origin is bottom-left
    renderInset(
      gl,
      scene,
      insetCam,
      left,
      size.height - top - height,
      width,
      height,
    );
  }, 1);

  return null;
}
