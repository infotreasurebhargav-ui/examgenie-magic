import { createServerFn } from "@tanstack/react-start";

const UPSTREAM_URL   = "https://api.sarvam.ai/v1/chat/completions";
const UPSTREAM_MODEL = "sarvam-105b";

// sarvam-105b is a reasoning model — it spends tokens thinking before answering.
// "low" effort minimises that overhead. 8192 gives room for both think + output.
const MAX_TOKENS_CAP    = 8192;
const REASONING_EFFORT  = "low";
// 55 s fetch timeout — Vercel function maxDuration is 60 s, so this leaves a
// small buffer to return a clean error instead of a hard function timeout.
const FETCH_TIMEOUT_MS  = 55_000;

type Msg = { role: "system" | "user" | "assistant"; content: string };

// Pull the best usable text from a Sarvam response message.
// The model may put the answer in `content` (normal) or only in
// `reasoning_content` (when truncated mid-think). We also strip
// any stray <think>…</think> wrapper some model versions emit.
function extractContent(msg: Record<string, unknown>): string {
  const raw = typeof msg.content === "string" ? msg.content : "";
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (text) return text;

  // Fallback: pull the last complete JSON block from reasoning_content
  const rc = typeof msg.reasoning_content === "string" ? msg.reasoning_content : "";
  if (rc) {
    const m = rc.match(/\{[\s\S]*\}(?=[^}]*$)/);
    if (m) return m[0].trim();
    return rc.trim();
  }
  return "";
}

export const aiChat = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: Msg[]; temperature?: number; max_tokens?: number }) => {
    if (!Array.isArray(data?.messages)) throw new Error("Invalid messages");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.SARVAM_API_KEY ?? "";
    if (!key) {
      throw new Error("SARVAM_API_KEY is not configured. Please add it in the Secrets panel.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(UPSTREAM_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: UPSTREAM_MODEL,
          messages: data.messages,
          temperature: data.temperature ?? 0.4,
          max_tokens: Math.min(data.max_tokens ?? MAX_TOKENS_CAP, MAX_TOKENS_CAP),
          reasoning_effort: REASONING_EFFORT,
          response_format: { type: "json_object" },
        }),
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new Error(
        isAbort
          ? "Generation timed out (model took too long). Try fewer questions or try again."
          : "Could not reach Sarvam AI. Check your connection and try again.",
      );
    }
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Sarvam upstream error", res.status, text);
      if (res.status === 401 || res.status === 403)
        throw new Error("Invalid or expired SARVAM_API_KEY. Please check your Secrets.");
      if (res.status === 429)
        throw new Error("Sarvam rate limit reached. Please wait a moment and try again.");
      if (res.status >= 500)
        throw new Error("Sarvam service is temporarily unavailable. Please try again.");
      throw new Error(`Generation failed (HTTP ${res.status}). Please try again.`);
    }

    const json = await res.json();
    const choice  = json?.choices?.[0] ?? {};
    const msg     = choice?.message ?? {};
    const finish  = choice?.finish_reason ?? "";

    const content = extractContent(msg as Record<string, unknown>);

    if (!content) {
      console.error("Empty content from Sarvam", finish, JSON.stringify(json).slice(0, 500));
      throw new Error(
        finish === "length"
          ? "Response was cut off — try fewer questions or shorter marks."
          : "Empty response from Sarvam. Please try again.",
      );
    }

    return { content };
  });
