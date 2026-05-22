import { createServerFn } from "@tanstack/react-start";

// Server-only proxy. The upstream key and provider never reach the browser.
const UPSTREAM_URL = "https://api.sarvam.ai/v1/chat/completions";
const UPSTREAM_KEY = "sk_0fh77312_BrMiRQMzpRkskVKEXdBx4DYX";
const UPSTREAM_MODEL = "sarvam-m";

// Raised from 2048 → 8192 so large papers don't get silently truncated.
// A 20-question paper with long answers can easily need 4000+ tokens.
const MAX_TOKENS_CAP = 8192;

type Msg = { role: "system" | "user" | "assistant"; content: string };

export const aiChat = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: Msg[]; temperature?: number; max_tokens?: number }) => {
    if (!Array.isArray(data?.messages)) throw new Error("Invalid messages");
    return data;
  })
  .handler(async ({ data }) => {
    const res = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UPSTREAM_KEY}`,
      },
      body: JSON.stringify({
        model: UPSTREAM_MODEL,
        messages: data.messages,
        temperature: data.temperature ?? 0.4,
        top_p: 1,
        max_tokens: Math.min(data.max_tokens ?? 4000, MAX_TOKENS_CAP),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Upstream error", res.status, text);
      throw new Error(`Generation service unavailable (${res.status})`);
    }
    const json = await res.json();
    const msg = json?.choices?.[0]?.message ?? {};
    let content: string = (msg.content ?? "").toString();
    // Strip <think>...</think> blocks some models emit inline
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!content && typeof msg.reasoning_content === "string") {
      content = msg.reasoning_content.trim();
    }
    if (!content) {
      const finish = json?.choices?.[0]?.finish_reason;
      console.error("Empty content from upstream", finish, JSON.stringify(json).slice(0, 500));
      throw new Error(
        finish === "length"
          ? "Response was truncated — reduce question count or try again."
          : "Empty response from generation service. Please try again.",
      );
    }
    return { content };
  });
