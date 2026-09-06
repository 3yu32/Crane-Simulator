/**
 * Minimal local backend for "style 3" (AI play): the only piece of this
 * project that isn't client-only.
 *
 *   POST /api/ai-move  — hold the Gemini API key server-side (from .env,
 *     never sent to the browser), relay the two views + prompt to Gemini
 *     via its OpenAI-compatible endpoint, return a parsed {x, z} move plus
 *     the token usage + a cost estimate. Every call is also appended to
 *     AI_LOG_DIR/usage.jsonl.
 *   POST /api/ai-log   — when style-3 logging is on, write one run to a
 *     local folder (AI_LOG_DIR, default ./ai-runs/<timestamp>/): the
 *     prompt, the model's reply, the input images, the post-move images,
 *     whether the prize was got (0/1), and the token usage + cost.
 *
 * No framework — Node's built-in http/fetch are enough.
 * Run with: npm run ai-server (needs .env, see .env.example).
 */

import http from "node:http";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
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

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const UPSTREAM_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOG_DIR = path.resolve(process.env.AI_LOG_DIR ?? path.join(process.cwd(), "ai-runs"));

// USD per 1M tokens. Defaults are a Flash-tier estimate — verify current
// prices at https://ai.google.dev/pricing and override in .env.
const PRICE_IN_PER_1M = Number(process.env.GEMINI_PRICE_INPUT_PER_1M ?? 0.3);
const PRICE_OUT_PER_1M = Number(process.env.GEMINI_PRICE_OUTPUT_PER_1M ?? 2.5);

function costUsd(usage) {
  if (!usage) return null;
  const inTok = usage.prompt_tokens ?? 0;
  const total = usage.total_tokens ?? 0;
  const comp = usage.completion_tokens ?? 0;
  // total − prompt also covers "thinking"/reasoning tokens, which Gemini
  // bills at the output rate; fall back to completion_tokens if no total.
  const outTok = total > inTok ? total - inTok : comp;
  const c = (inTok / 1e6) * PRICE_IN_PER_1M + (outTok / 1e6) * PRICE_OUT_PER_1M;
  return Math.round(c * 1e8) / 1e8;
}

function appendUsageLine(entry) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(path.join(LOG_DIR, "usage.jsonl"), JSON.stringify(entry) + "\n");
  } catch (err) {
    console.warn("could not append usage.jsonl:", err.message);
  }
}

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

/** Decode a `data:image/...;base64,...` URL to a Buffer + file extension. */
function decodeDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s.exec(dataUrl ?? "");
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  return { buffer: Buffer.from(m[2], "base64"), ext };
}

async function handleAiMove(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error: "GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.",
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
    sendJson(res, 502, { error: `could not reach Gemini: ${err.message}` });
    return;
  }

  if (!upstream.ok) {
    sendJson(res, upstream.status, {
      error: data?.error?.message ?? "Gemini returned an error",
      raw: data,
    });
    return;
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  const flatText = typeof text === "string" ? text : JSON.stringify(text);
  const parsed = extractJson(flatText);

  const usage = data.usage ?? null;
  const cost = costUsd(usage);

  if (!parsed || typeof parsed.x !== "number" || typeof parsed.z !== "number") {
    sendJson(res, 502, {
      error: "could not parse a {x, z} move out of the model's reply",
      raw: flatText,
      usage,
      costUsd: cost,
    });
    return;
  }

  const strategy = typeof parsed.strategy === "string" ? parsed.strategy.trim() : null;

  appendUsageLine({
    timestamp: new Date().toISOString(),
    model: MODEL,
    strategy,
    move: { x: parsed.x, z: parsed.z },
    usage,
    costUsd: cost,
  });

  sendJson(res, 200, {
    x: parsed.x,
    z: parsed.z,
    strategy,
    raw: flatText,
    usage,
    costUsd: cost,
  });
}

async function handleAiLog(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    sendJson(res, 400, { error: `invalid request body: ${err.message}` });
    return;
  }

  const images = {
    input_front: decodeDataUrl(body.inputFront),
    input_side: decodeDataUrl(body.inputSide),
    result_front: decodeDataUrl(body.resultFront),
    result_side: decodeDataUrl(body.resultSide),
  };

  // Unique folder — never reuse/overwrite an existing run's directory.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let dir = path.join(LOG_DIR, stamp);
  for (let n = 2; existsSync(dir); n++) dir = path.join(LOG_DIR, `${stamp}_${n}`);

  try {
    mkdirSync(dir, { recursive: true });
    for (const [name, decoded] of Object.entries(images)) {
      if (decoded) writeFileSync(path.join(dir, `${name}.${decoded.ext}`), decoded.buffer);
    }
    writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          model: MODEL,
          strategy: body.strategy ?? null,
          prompt: body.prompt ?? null,
          response: body.response ?? null,
          move: body.move ?? null,
          got: body.got ?? null,
          gotBefore: body.gotBefore ?? null,
          usage: body.usage ?? null,
          costUsd: body.costUsd ?? null,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    sendJson(res, 500, { error: `could not write log: ${err.message}` });
    return;
  }

  sendJson(res, 200, { dir });
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

  if (req.method === "POST" && req.url === "/api/ai-move") {
    await handleAiMove(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/ai-log") {
    await handleAiLog(req, res);
    return;
  }
  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`AI move backend listening on http://localhost:${PORT}`);
  console.log(`model: ${MODEL}`);
  console.log(`logs (when style-3 logging is on): ${LOG_DIR}`);
  if (!API_KEY) {
    console.warn("GEMINI_API_KEY is not set — requests will fail until .env is configured.");
  }
});
