import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(__dirname, "../dist/client");

// TanStack Start serves client assets under the /_build base path.
// In the filesystem they live at dist/client/ (without the /_build prefix).
const CLIENT_BASE = "/_build";

const MIME_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

// Map a URL path to a filesystem path inside dist/client/.
// /_build/assets/foo.js  →  dist/client/assets/foo.js
// /icon-192.png          →  dist/client/icon-192.png
function urlToClientPath(reqPath) {
  const stripped = reqPath.startsWith(CLIENT_BASE)
    ? reqPath.slice(CLIENT_BASE.length)
    : reqPath;
  const rel = stripped.startsWith("/") ? stripped : "/" + stripped;
  return path.join(CLIENT_DIR, rel);
}

// Attempt to serve a static file from dist/client/. Returns true if served.
function tryServeStatic(req, res) {
  const reqPath = req.url.split("?")[0].split("#")[0];
  const filePath = urlToClientPath(reqPath);

  // Security: must stay inside CLIENT_DIR
  if (!filePath.startsWith(CLIENT_DIR + path.sep) && filePath !== CLIENT_DIR) {
    return false;
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Hashed asset filenames get long-lived immutable cache.
  const isHashed = /\.[a-f0-9]{8,}\.\w+$/.test(path.basename(filePath));
  const cacheControl = isHashed
    ? "public, max-age=31536000, immutable"
    : "public, max-age=0, must-revalidate";

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// Lazily load the TanStack Start server bundle.
// The bundle is included in the Vercel function via vercel.json `includeFiles`.
let _server = null;
async function getServer() {
  if (!_server) {
    const mod = await import("../dist/server/server.js");
    _server = mod.default ?? mod;
  }
  return _server;
}

// Read the full body from a Node.js IncomingMessage as a Buffer.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // 1. Serve static assets directly (skips SSR for performance + CDN caching).
  if (tryServeStatic(req, res)) return;

  try {
    // 2. Forward everything else to TanStack Start SSR / server-function handler.
    const server = await getServer();

    const host =
      req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const url = `${proto}://${host}${req.url}`;

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const bodyBuf = hasBody ? await readBody(req) : null;

    const headers = new Headers();
    for (const [key, raw] of Object.entries(req.headers)) {
      if (raw == null) continue;
      headers.set(key, Array.isArray(raw) ? raw.join(", ") : raw);
    }

    const fetchInit = { method: req.method, headers };
    if (bodyBuf && bodyBuf.length > 0) {
      fetchInit.body = bodyBuf;
      fetchInit.duplex = "half";
    }

    const request = new Request(url, fetchInit);
    // Pass undefined for the Cloudflare env/ctx args (not used in Node.js mode).
    const response = await server.fetch(request, undefined, undefined);

    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      res.setHeader(key, value);
    }

    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[vercel-handler] Unhandled error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html><body><h1>500 – Server Error</h1><pre>${String(err)}</pre></body></html>`
    );
  }
}
