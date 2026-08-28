/**
 * A second, always-on view of the same scene from the side (looking along −X).
 * One view fills the screen, the other is a small inset under the ARM panel;
 * clicking the inset (see App.tsx) swaps which is which.
 *
 * Implemented as an extra render pass: taking a render priority makes R3F yield
 * the render loop, so this callback draws the main camera and then the inset.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  PerspectiveCamera,
  type PerspectiveCamera as TPerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";
import type { GameConfig } from "../config/gameConfig";
import { getState } from "../game/gameStore";

/** Inset placement in CSS pixels (must match `.side-view-frame` in App.css). */
const SIDE_VIEW_RECT = { left: 14, top: 288, width: 232, height: 136 };

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
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as TPerspectiveCamera;
  const size = useThree((s) => s.size);

  const sideCamRef = useRef<TPerspectiveCamera>(null);
  if (sideCamRef.current === null) {
    sideCamRef.current = new PerspectiveCamera(40, 1, 0.1, 100);
  }

  const cz = config.bridge.rodCenterZ;
  useEffect(() => {
    const sideCam = sideCamRef.current;
    if (!sideCam) return;
    sideCam.position.set(8.4, 3.1, cz + 0.1);
    sideCam.lookAt(0.15, 1.55, cz);
    sideCam.updateProjectionMatrix();
  }, [cz]);

  useFrame(() => {
    const sideCam = sideCamRef.current;
    if (!sideCam) return;
    const swapped = getState().sideViewSwapped;
    const mainCam = swapped ? sideCam : camera;
    const insetCam = swapped ? camera : sideCam;
    const { left, top, width, height } = SIDE_VIEW_RECT;

    // Only sideCam's aspect is ours to change; R3F keeps `camera` synced.
    sideCam.aspect = swapped
      ? size.width / size.height
      : width / height;
    sideCam.updateProjectionMatrix();

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
