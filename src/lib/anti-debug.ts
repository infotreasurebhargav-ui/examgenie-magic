// Defensive measures to discourage casual inspection.
// Nothing client-side is bulletproof — the real secret (API key) lives only on the server.

const noop = () => {};

export function installShield() {
  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) return; // keep DX usable while developing

  // Block context menu
  window.addEventListener("contextmenu", (e) => e.preventDefault(), { capture: true });

  // Block common shortcuts: F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U, Ctrl/Cmd+S
  window.addEventListener(
    "keydown",
    (e) => {
      const k = e.key?.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (
        k === "f12" ||
        (mod && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
        (mod && (k === "u" || k === "s"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );

  // Disable selection / drag of source-like content
  window.addEventListener("dragstart", (e) => e.preventDefault());

  // Neutralize console
  try {
    const c = window.console as Console;
    (["log", "info", "warn", "error", "debug", "trace", "table", "dir"] as const).forEach((m) => {
      (c as unknown as Record<string, typeof noop>)[m] = noop;
    });
  } catch {}

  // Devtools-open detection (size heuristic + debugger trap)
  let blocked = false;
  const block = () => {
    if (blocked) return;
    blocked = true;
    document.documentElement.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b12;color:#e6e6f0;font-family:system-ui;text-align:center;padding:24px;">Access blocked. Close developer tools to continue.</div>';
    setTimeout(() => location.reload(), 1500);
  };

  setInterval(() => {
    const threshold = 170;
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      block();
    }
    const t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - t0 > 100) block();
  }, 1000);
}
