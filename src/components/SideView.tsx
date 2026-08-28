/**
 * A second, always-on view of the same scene from the side (looking along −X),
 * rendered as a small inset under the ARM panel. Lets the player judge the
 * claw's depth (Z) position and the cable descent.
 *
 * Implemented as an extra render pass: taking a render priority makes R3F yield
 * the render loop, so this callback draws the main camera and then the inset.
 */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import type { GameConfig } from "../config/gameConfig";

/** Inset placement in CSS pixels (must match `.side-view-frame` in App.css). */
const SIDE_VIEW_RECT = { left: 14, top: 286, width: 232, height: 138 };

function renderInset(
  renderer: WebGLRenderer,
  scene: Scene,
  cam: PerspectiveCamera,
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
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const sideCam = useMemo(
    () =>
      new PerspectiveCamera(
        36,
        SIDE_VIEW_RECT.width / SIDE_VIEW_RECT.height,
        0.1,
        100,
      ),
    [],
  );

  // Aim from the +X side (looking along −X) so depth (Z) reads left-right and
  // the cable descent reads vertically.
  const cz = config.bridge.rodCenterZ;
  useEffect(() => {
    sideCam.position.set(7.6, 2.9, cz + 0.05);
    sideCam.lookAt(0.2, 1.55, cz);
    sideCam.updateProjectionMatrix();
  }, [sideCam, cz]);

  useFrame(() => {
    // THREE's setViewport/setScissor take CSS pixels and apply the pixel ratio
    // internally, so work in CSS units here.

    // main view — full frame
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.render(scene, camera);

    // side inset — viewport origin is bottom-left
    const { left, top, width, height } = SIDE_VIEW_RECT;
    renderInset(
      gl,
      scene,
      sideCam,
      left,
      size.height - top - height,
      width,
      height,
    );
  }, 1);

  return null;
}
