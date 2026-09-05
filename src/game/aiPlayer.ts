/**
 * Style 3 (AI play): capture the front and side views as images, send them to
 * Gemini along with the play prompt, and turn its reply into an (X, Z) move.
 * The only network calls in this client-only app go to the small local
 * backend (server/index.mjs) — it holds the API key, and (when style-3
 * logging is on) also writes each run to a local folder.
 */

import type { WebGLRenderer } from "three";
import type { GameConfig } from "../config/gameConfig";
import { getState } from "./gameStore";
import { SIDE_VIEW_RECT } from "./viewportCamera";

const AI_BACKEND_URL =
  (import.meta.env.VITE_AI_BACKEND_URL as string | undefined) ?? "http://localhost:8787";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cropToDataUrl(source: HTMLCanvasElement, rect: Rect): string {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.w));
  out.height = Math.max(1, Math.round(rect.h));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("画面の撮影に失敗しました (2D context unavailable)");
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.85);
}

/**
 * Front and side views currently live in the same canvas — one fills it, the
 * other is scissored into the SideView inset (see SideView.tsx) — so getting
 * each as its own image just means cropping the right region for whichever
 * is currently where.
 */
export function captureViews(gl: WebGLRenderer): { front: string; side: string } {
  const canvas = gl.domElement;
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;
  const swapped = getState().sideViewSwapped;

  const fullRect: Rect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const insetRect: Rect = {
    x: SIDE_VIEW_RECT.left * scaleX,
    y: SIDE_VIEW_RECT.top * scaleY,
    w: SIDE_VIEW_RECT.width * scaleX,
    h: SIDE_VIEW_RECT.height * scaleY,
  };

  const frontRect = swapped ? insetRect : fullRect;
  const sideRect = swapped ? fullRect : insetRect;

  return {
    front: cropToDataUrl(canvas, frontRect),
    side: cropToDataUrl(canvas, sideRect),
  };
}

function buildPrompt(config: GameConfig): string {
  const { minX, maxX, minZ, maxZ } = config.crane;
  return [
    "あなたはクレーンゲームのプレイヤーです。",
    "この画像を見て、次の1手を決めてください。",
    "1枚目は正面からの画像、2枚目は横からの画像です。",
    "景品は縦長の箱で、橋渡し設定です。",
    "操作は「右移動」「奥移動」を指定したあと、アームが自動で下降・閉じるものとします。",
    "",
    "機体内には座標の目盛りが表示されています。",
    "奥の壁に沿った水色の目盛り（末尾に「X」）が X 軸（左右）で、" +
      `${minX.toFixed(2)} から ${maxX.toFixed(2)} の範囲です。`,
    "左の壁に沿ったオレンジの目盛り（末尾に「Z」）が Z 軸（奥行き）で、" +
      `${minZ.toFixed(2)}（最も奥）から ${maxZ.toFixed(2)}（最も手前）の範囲です。`,
    "目盛りを読み取って、景品の中心の真上にアームが来る座標を答えてください。",
    "",
    "出力はJSONのみ。他の文章は一切含めないでください。",
    '形式: {"x": 数値, "z": 数値}',
  ].join("\n");
}

interface AiMoveResponse {
  x?: unknown;
  z?: unknown;
  raw?: unknown;
  error?: string;
}

export interface AiMoveResult {
  move: { x: number; z: number };
  /** The exact prompt text sent to the model. */
  prompt: string;
  /** The model's raw reply text. */
  response: string;
  /** The (data-URL) images that were sent to the model. */
  inputFront: string;
  inputSide: string;
}

/** Capture both views, ask Gemini for a move, and clamp it to the crane's travel bounds. */
export async function requestAiMove(
  config: GameConfig,
  gl: WebGLRenderer,
): Promise<AiMoveResult> {
  const { front, side } = captureViews(gl);
  const prompt = buildPrompt(config);

  let res: Response;
  try {
    res = await fetch(`${AI_BACKEND_URL}/api/ai-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frontImage: front, sideImage: side, prompt }),
    });
  } catch {
    throw new Error(
      `AIバックエンド (${AI_BACKEND_URL}) に接続できません。"npm run ai-server" を起動してください。`,
    );
  }

  const data = (await res.json().catch(() => null)) as AiMoveResponse | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? `AIバックエンドがエラーを返しました (${res.status})`);
  }
  if (typeof data.x !== "number" || typeof data.z !== "number") {
    throw new Error(data.error ?? "AIの応答から座標を取得できませんでした。");
  }

  const { minX, maxX, minZ, maxZ } = config.crane;
  return {
    move: {
      x: Math.min(maxX, Math.max(minX, data.x)),
      z: Math.min(maxZ, Math.max(minZ, data.z)),
    },
    prompt,
    response: typeof data.raw === "string" ? data.raw : "",
    inputFront: front,
    inputSide: side,
  };
}

export interface AiLogEntry {
  prompt: string;
  response: string;
  move: { x: number; z: number };
  inputFront: string;
  inputSide: string;
  resultFront: string;
  resultSide: string;
  /** 1 = prize was in the goal at the end of the run, 0 = not. */
  got: 0 | 1;
  gotBefore: 0 | 1;
}

/** Persist one style-3 run to the backend's local log folder. */
export async function postAiLog(entry: AiLogEntry): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${AI_BACKEND_URL}/api/ai-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    throw new Error(`記録の保存に失敗しました: AIバックエンド (${AI_BACKEND_URL}) に接続できません。`);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`記録の保存に失敗しました: ${data?.error ?? res.status}`);
  }
}
