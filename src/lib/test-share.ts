import type { Paper } from "./paper-types";

// Encode a paper into a URL-safe string. No backend needed — link is self-contained.
function toB64(s: string) {
  if (typeof window === "undefined") return Buffer.from(s, "utf-8").toString("base64");
  return btoa(unescape(encodeURIComponent(s)));
}
function fromB64(s: string) {
  if (typeof window === "undefined") return Buffer.from(s, "base64").toString("utf-8");
  return decodeURIComponent(escape(atob(s)));
}

export function encodePaper(p: Paper): string {
  const j = JSON.stringify(p);
  return toB64(j).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodePaper(token: string): Paper {
  const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
  const b = (token + pad).replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(fromB64(b));
}

export function buildTestUrl(p: Paper): string {
  const token = encodePaper(p);
  return `${window.location.origin}/test/${token}`;
}
