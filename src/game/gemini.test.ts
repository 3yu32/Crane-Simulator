import { afterEach, describe, expect, it, vi } from "vitest";
import { requestGeminiMove } from "./gemini";

const ok = (content: string, usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 220 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });
const err = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { message } }), { status: status });

afterEach(() => vi.unstubAllGlobals());

describe("requestGeminiMove", () => {
  it("parses a fenced JSON move, estimates cost (incl. thinking tokens) and sends the key only as a bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok('```json\n{"strategy":"中央を狙う","x":0.2,"y":-0.4}\n```'));
    vi.stubGlobal("fetch", fetchMock);

    const r = await requestGeminiMove("KEY123", "p", "data:front", "data:side");

    expect(r).toMatchObject({ x: 0.2, y: -0.4, strategy: "中央を狙う" });
    // output side = total − prompt = 120 tokens
    expect(r.costUsd).toBeCloseTo((100 / 1e6) * 0.3 + (120 / 1e6) * 2.5, 8);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer KEY123" });
    expect(String(url)).not.toContain("KEY123");
    expect(String((init as RequestInit).body)).not.toContain("KEY123");
  });

  it("maps bad-key responses to a clear message without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(400, "API key not valid"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestGeminiMove("bad", "p", "f", "s")).rejects.toThrow("APIキーが無効");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient 503s and then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(503, "overloaded"))
      .mockResolvedValueOnce(ok('{"x":1,"y":2}'));
    vi.stubGlobal("fetch", fetchMock);
    const p = requestGeminiMove("k", "p", "f", "s");
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ x: 1, y: 2, strategy: "" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("rejects a reply with no usable coordinates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("すみません、分かりません")));
    await expect(requestGeminiMove("k", "p", "f", "s")).rejects.toThrow("座標");
  });
});
