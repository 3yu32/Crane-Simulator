/**
 * Style 3 (AI play) driver. Lives inside <Canvas> purely to get at the
 * WebGLRenderer for capturing the two views; everything else routes through
 * the store, same as the rest of the app.
 *
 * Watches `aiPlayNonce` (bumped by the プレイ button, see AIControls.tsx):
 * capture front/side views → ask Qwen2.5-VL (via the local backend) for an
 * (X, Z) move → feed it into the exact same pipeline style 2 uses
 * (setDirectTarget + goDirect).
 */

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { GameConfig } from "../config/gameConfig";
import { requestAiMove } from "../game/aiPlayer";
import {
  getState,
  goDirect,
  setAiError,
  setAiLastMove,
  setAiStatus,
  setDirectTarget,
  subscribe,
} from "../game/gameStore";

export function AIPlayer({ config }: { config: GameConfig }) {
  const gl = useThree((s) => s.gl);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let lastNonce = getState().aiPlayNonce;

    const runAiMove = async () => {
      if (getState().craneState !== "IDLE") {
        setAiError("アームが移動中はAIプレイできません（IDLE状態でのみ実行できます）");
        return;
      }
      try {
        setAiStatus("thinking");
        const move = await requestAiMove(configRef.current, gl);
        setAiLastMove(move);
        setDirectTarget(move);
        goDirect();
        setAiStatus("idle");
      } catch (err) {
        setAiError(err instanceof Error ? err.message : String(err));
      }
    };

    const unsubscribe = subscribe(() => {
      const nonce = getState().aiPlayNonce;
      if (nonce !== lastNonce) {
        lastNonce = nonce;
        void runAiMove();
      }
    });
    return unsubscribe;
  }, [gl]);

  return null;
}
