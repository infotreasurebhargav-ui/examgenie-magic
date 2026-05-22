import { createServerFn } from "@tanstack/react-start";

// Server-only proxy. The upstream key and provider never reach the browser.
const UPSTREAM_URL = "https://api.sarvam.ai/v1/chat/completions";
const UPSTREAM_MODEL = "sarvam-105b";

// sarvam-105b is a REASONING model — it spends tokens on internal thinking
// before producing output. The "low" effort setting minimises reasoning tokens
// so most of the budget is available for the actual JSON response.
// The hard cap is raised from 2048 → 8192 to give the model room to breathe.
const MAX_TOKENS_CAP = 8192;
const REASONING_EFFORT = "low";

type Msg = { role: "system" | "user" | "assistant"; content: string };

// Extract the best usable text from an API response message.
// sarvam-105b can return content in two places:
//   • message.content          — the final answer (preferred)
//   • message.reasoning_content — the chain-of-thought (fallback)
// When the model truncates before finishing reasoning, content is null but
// reasoning_content may still contain a complete JSON block we can salvage.
function extractContent(msg: Record<string, unknown>): string {
  // 1. Use message.content if present and non-empty
  let text = (typeof msg.content === "string" ? msg.content : "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  if (text) return text;

  // 2. Fall back to reasoning_content — look for a JSON block inside it
  const rc = typeof msg.reasoning_content === "string" ? msg.reasoning_content : "";
  if (rc) {
    // Try to pull out the last {...} block the model wrote in its thinking
    const jsonMatch = rc.match(/\{[\s\S]*\}(?=[^}]*$)/);
    if (jsonMatch) {
      return jsonMatch[0].trim();
    }
    // Return the full reasoning as last resort so callers can attempt repair
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

    const requestedTokens = data.max_tokens ?? MAX_TOKENS_CAP;
    const cappedTokens = Math.min(requestedTokens, MAX_TOKENS_CAP);

    const res = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: UPSTREAM_MODEL,
        messages: data.messages,
        temperature: data.temperature ?? 0.4,
        max_tokens: cappedTokens,
        reasoning_effort: REASONING_EFFORT,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Sarvam upstream error", res.status, text);
      // Surface a readable message for common status codes
      if (res.status === 401 || res.status === 403) {
        throw new Error("Invalid or expired SARVAM_API_KEY. Please check your Secrets.");
      }
      if (res.status === 429) {
        throw new Error("Sarvam rate limit reached. Please wait a moment and try again.");
      }
      if (res.status >= 500) {
        throw new Error("Sarvam service is temporarily unavailable. Please try again.");
      }
      throw new Error(`Generation failed (HTTP ${res.status}). Please try again.`);
    }

    const json = await res.json();
    const choice = json?.choices?.[0] ?? {};
    const msg = choice?.message ?? {};
    const finishReason: string = choice?.finish_reason ?? "";

    const content = extractContent(msg as Record<string, unknown>);

    if (!content) {
      console.error("Empty content from Sarvam", finishReason, JSON.stringify(json).slice(0, 500));
      if (finishReason === "length") {
        throw new Error(
          "Response was cut off — try fewer questions or shorter marks. (Token limit reached)"
        );
      }
      throw new Error("Empty response from Sarvam. Please try again.");
    }

    return { content };
  });
