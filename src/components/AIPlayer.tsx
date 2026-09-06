/**
 * Style 3 (AI play) driver. Lives inside <Canvas> purely to get at the
 * WebGLRenderer for capturing the two views; everything else routes through
 * the store, same as the rest of the app.
 *
 * Watches `aiPlayNonce` (bumped by the プレイ button, see CraneControls.tsx):
 * capture front/side views → ask Gemini (via the local backend) for an
 * (X, Z) move → feed it into the exact same pipeline style 2 uses
 * (setDirectTarget + goDirect).
 *
 * When `aiLogging` is on, it then waits for the crane sequence to finish,
 * captures the after-move views, reads whether the prize was got (0/1), and
 * POSTs the whole run to the backend's local log folder.
 */

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import type { GameConfig } from "../config/gameConfig";
import {
  captureViews,
  postAiLog,
  requestAiMove,
  type TokenUsage,
} from "../game/aiPlayer";
import {
  getState,
  goDirect,
  setAiError,
  setAiLastMove,
  setAiLastUsage,
  setAiStatus,
  setDirectTarget,
  subscribe,
} from "../game/gameStore";

function toAiUsage(usage: TokenUsage | null, costUsd: number | null) {
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    costUsd,
  };
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolve once the crane has left IDLE and returned to it (or a timeout). */
function waitForCraneReturn(timeoutMs = 45000): Promise<void> {
  return new Promise((resolve) => {
    let leftIdle = getState().craneState !== "IDLE";
    const finish = () => {
      unsub();
      clearTimeout(timer);
      resolve();
    };
    const unsub = subscribe(() => {
      const s = getState().craneState;
      if (s !== "IDLE") leftIdle = true;
      else if (leftIdle) finish();
    });
    const timer = setTimeout(finish, timeoutMs);
  });
}

export function AIPlayer({ config }: { config: GameConfig }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
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
        const result = await requestAiMove(configRef.current, gl, scene, camera);
        setAiLastMove(result.move);
        setAiLastUsage(toAiUsage(result.usage, result.costUsd));

        const gotBefore = getState().prizeGet ? 1 : 0;
        setDirectTarget(result.move);
        goDirect();

        if (!getState().aiLogging) {
          setAiStatus("idle");
          return;
        }

        setAiStatus("recording");
        await waitForCraneReturn();
        await delay(1800); // let a dropped prize land before the after-shot
        const after = captureViews(gl, scene, camera);
        const got = getState().prizeGet ? 1 : 0;
        await postAiLog({
          prompt: result.prompt,
          response: result.response,
          move: result.move,
          inputFront: result.inputFront,
          inputSide: result.inputSide,
          resultFront: after.front,
          resultSide: after.side,
          got,
          gotBefore,
          usage: result.usage,
          costUsd: result.costUsd,
        });
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
  }, [gl, scene, camera]);

  return null;
}
