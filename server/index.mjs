/**
 * Minimal local backend for "style 3" (AI play): the only piece of this
 * project that isn't client-only. Its one job is to hold the vision-model
 * API key server-side (read from .env, never sent to the browser) and relay
 * the two captured views + prompt, returning a parsed {x, z} move.
 *
 * Supports two providers behind the same OpenAI-style chat-completions
 * shape (both DashScope and Gemini expose an OpenAI-compatible endpoint):
 * set AI_PROVIDER=dashscope (Qwen2.5-VL, default) or AI_PROVIDER=gemini
 * (Gemini 2.5 Flash) in .env.
 *
 * No framework — Node's built-in http/fetch are enough for one route.
 * Run with: npm run ai-server (needs .env, see .env.example).
 */

import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const PORT = Number(process.env.AI_SERVER_PORT ?? 8787);
const MAX_BODY_BYTES = 24 * 1024 * 1024; // images are base64, allow headroom

const PROVIDERS = {
  dashscope: {
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    keyEnv: "DASHSCOPE_API_KEY",
    modelEnv: "DASHSCOPE_MODEL",
    defaultModel: "qwen2.5-vl-72b-instruct",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
  },
};

const PROVIDER_NAME = process.env.AI_PROVIDER ?? "dashscope";
const PROVIDER = PROVIDERS[PROVIDER_NAME];
if (!PROVIDER) {
  console.error(
    `Unknown AI_PROVIDER "${PROVIDER_NAME}" — expected one of: ${Object.keys(PROVIDERS).join(", ")}`,
  );
  process.exit(1);
}

const API_KEY = process.env[PROVIDER.keyEnv];
const MODEL = process.env[PROVIDER.modelEnv] ?? PROVIDER.defaultModel;
const UPSTREAM_URL = PROVIDER.url;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Pull the first {...} JSON object out of the model's reply, fenced or not. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/ai-move") {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  if (!API_KEY) {
    sendJson(res, 500, {
      error: `${PROVIDER.keyEnv} is not set. Copy .env.example to .env and fill it in.`,
    });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    sendJson(res, 400, { error: `invalid request body: ${err.message}` });
    return;
  }

  const { frontImage, sideImage, prompt } = body;
  if (!frontImage || !sideImage || !prompt) {
    sendJson(res, 400, { error: "frontImage, sideImage and prompt are all required" });
    return;
  }

  const payload = {
    model: MODEL,
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

  let upstream;
  let data;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    data = await upstream.json();
  } catch (err) {
    sendJson(res, 502, { error: `could not reach ${PROVIDER_NAME}: ${err.message}` });
    return;
  }

  if (!upstream.ok) {
    sendJson(res, upstream.status, {
      error: data?.error?.message ?? `${PROVIDER_NAME} returned an error`,
      raw: data,
    });
    return;
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  const flatText = typeof text === "string" ? text : JSON.stringify(text);
  const parsed = extractJson(flatText);

  if (!parsed || typeof parsed.x !== "number" || typeof parsed.z !== "number") {
    sendJson(res, 502, {
      error: "could not parse a {x, z} move out of the model's reply",
      raw: flatText,
    });
    return;
  }

  sendJson(res, 200, { x: parsed.x, z: parsed.z, raw: flatText });
});

server.listen(PORT, () => {
  console.log(`AI move backend listening on http://localhost:${PORT}`);
  console.log(`provider: ${PROVIDER_NAME} (model: ${MODEL})`);
  if (!API_KEY) {
    console.warn(`${PROVIDER.keyEnv} is not set — requests will fail until .env is configured.`);
  }
});
