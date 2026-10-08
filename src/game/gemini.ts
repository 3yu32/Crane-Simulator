/**
 * Direct browser → Gemini call (bring-your-own-key mode). Mirrors what the
 * local backend (server/index.mjs) does, minus anything that needs a server:
 * retry transient errors, pull the {x, y, strategy} JSON out of the reply and
 * estimate the cost. The key is sent only to Google, in an Authorization
 * header, and is never logged.
 */

import type { TokenUsage } from "./aiPlayer";

const UPSTREAM_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_MODEL = "gemini-3.6-flash";

// USD per 1M tokens — a Flash-tier estimate; see https://ai.google.dev/pricing.
const PRICE_IN_PER_1M = 0.3;
const PRICE_OUT_PER_1M = 2.5;

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

export interface GeminiMove {
  x: number;
  y: number;
  strategy: string;
  raw: string;
  usage: TokenUsage | null;
  costUsd: number | null;
}

function costUsd(usage: TokenUsage | null): number | null {
  if (!usage) return null;
  const inTok = usage.prompt_tokens ?? 0;
  const total = usage.total_tokens ?? 0;
  const comp = usage.completion_tokens ?? 0;
  // total − prompt also covers "thinking" tokens, billed at the output rate.
  const outTok = total > inTok ? total - inTok : comp;
  const c = (inTok / 1e6) * PRICE_IN_PER_1M + (outTok / 1e6) * PRICE_OUT_PER_1M;
  return Math.round(c * 1e8) / 1e8;
}

/** Pull the first {...} JSON object out of the model's reply, fenced or not. */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function requestGeminiMove(
  apiKey: string,
  prompt: string,
  frontImage: string,
  sideImage: string,
): Promise<GeminiMove> {
  const payload = {
    model: GEMINI_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: frontImage } },
          { type: "image_url", image_url: { url: sideImage } },
        ],
      },
    ],
  };

  // `any` shape of Gemini's OpenAI-compatible response is narrowed below.
  let data: {
    choices?: { message?: { content?: unknown } }[];
    usage?: TokenUsage;
    error?: { message?: string };
  } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(UPSTREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      data = await res.json().catch(() => null);
    } catch {
      res = null;
    }

    if (res?.ok) break;

    const retryable = !res || RETRY_STATUSES.has(res.status);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      if (!res) {
        throw new Error("Gemini に接続できません。ネットワーク接続を確認してください。");
      }
      const detail = data?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error(`APIキーが無効か、権限がありません (${detail})`);
      }
      if (res.status === 429) {
        throw new Error(`レート制限中です。少し待って再実行してください。(${detail})`);
      }
      throw new Error(`Gemini がエラーを返しました: ${detail}`);
    }
    await sleep(800 * 2 ** (attempt - 1));
  }

  const content = data?.choices?.[0]?.message?.content ?? "";
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  const parsed = extractJson(raw);
  const usage = data?.usage ?? null;

  if (!parsed || typeof parsed.x !== "number" || typeof parsed.y !== "number") {
    throw new Error("AIの応答から座標を取得できませんでした。");
  }
  return {
    x: parsed.x,
    y: parsed.y,
    strategy: typeof parsed.strategy === "string" ? parsed.strategy.trim() : "",
    raw,
    usage,
    costUsd: costUsd(usage),
  };
}
