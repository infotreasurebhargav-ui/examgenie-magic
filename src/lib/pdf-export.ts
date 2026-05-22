import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Walk up the DOM from `el` and temporarily un-hide any ancestor
 * (or the element itself) that has display:none or visibility:hidden.
 * Returns a function that restores the original values.
 *
 * This is critical for Radix UI TabsContent — inactive tabs get a
 * `hidden` attribute (= display:none) so html2canvas captures nothing.
 */
function forceVisibleChain(el: HTMLElement): () => void {
  const restores: Array<() => void> = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement) {
    const n = node;
    const cs = window.getComputedStyle(n);
    if (cs.display === "none") {
      const prev = n.style.display;
      const hadHidden = n.hasAttribute("hidden");
      n.removeAttribute("hidden");
      n.style.display = "block";
      restores.push(() => {
        n.style.display = prev;
        if (hadHidden) n.setAttribute("hidden", "");
      });
    }
    if (cs.visibility === "hidden") {
      const prev = n.style.visibility;
      n.style.visibility = "visible";
      restores.push(() => { n.style.visibility = prev; });
    }
    node = node.parentElement;
  }
  return () => restores.forEach((r) => r());
}

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  try {
    if (document.fonts) {
      try { await document.fonts.ready; } catch {}
    }

    // 1 ── Locate the paper surface
    const paper = el.querySelector<HTMLElement>(".paper-sheet") ?? el;

    // 2 ── Temporarily force the element (and any hidden Radix ancestor) visible
    //      so we can clone it with all computed styles intact.
    const restoreVisible = forceVisibleChain(paper);

    // 3 ── Clone the element WHILE it is visible
    const clone = paper.cloneNode(true) as HTMLElement;

    // 4 ── Restore original visibility immediately — we have the clone now
    restoreVisible();

    // 5 ── Mount the clone just off the LEFT edge of the viewport.
    //      NEVER use opacity:0 or visibility:hidden on the host —
    //      html2canvas multiplies ancestor opacity and renders everything
    //      transparent. Fixed + left:-N is safe.
    const CLONE_WIDTH_PX = 820;
    const host = document.createElement("div");
    host.style.cssText = [
      "position:fixed",
      "top:0",
      `left:-${CLONE_WIDTH_PX + 20}px`,
      `width:${CLONE_WIDTH_PX}px`,
      "background:#ffffff",
      "pointer-events:none",
      "z-index:9999",
    ].join(";");
    host.appendChild(clone);
    document.body.appendChild(host);

    // 6 ── Clean up clone styles for PDF capture
    clone.style.width = `${CLONE_WIDTH_PX}px`;
    clone.style.maxWidth = "none";
    clone.style.margin = "0";
    clone.style.boxShadow = "none";
    clone.style.borderRadius = "0";

    // 7 ── Wait two animation frames + 300 ms for browser to fully paint
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    await new Promise((r) => setTimeout(r, 300));

    const A4_W = 210;
    const A4_H = 297;
    const MARGIN = 12;
    const CONTENT_W = A4_W - MARGIN * 2;
    const CONTENT_H = A4_H - MARGIN * 2;
    const SCALE = 3;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    try {
      const canvas = await html2canvas(clone, {
        scale: SCALE,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: CLONE_WIDTH_PX,
      });

      const mmPerPx = CONTENT_W / canvas.width;
      const pagePxH = Math.floor(CONTENT_H / mmPerPx);

      // Page-break positions at [data-pdf-section] boundaries
      const cloneRect = clone.getBoundingClientRect();
      const sectionEls = Array.from(
        clone.querySelectorAll<HTMLElement>("[data-pdf-section]"),
      );
      const safeBreaks = new Set<number>([0]);
      for (const sec of sectionEls) {
        const top = Math.round(
          (sec.getBoundingClientRect().top - cloneRect.top) * SCALE,
        );
        safeBreaks.add(Math.max(0, top));
      }
      const breaksSorted = Array.from(safeBreaks).sort((a, b) => a - b);

      const slices: { start: number; end: number }[] = [];
      let offset = 0;
      while (offset < canvas.height) {
        const ideal = offset + pagePxH;
        if (ideal >= canvas.height) {
          slices.push({ start: offset, end: canvas.height });
          break;
        }
        let cut = ideal;
        for (let i = breaksSorted.length - 1; i >= 0; i--) {
          if (breaksSorted[i] > offset && breaksSorted[i] <= ideal) {
            cut = breaksSorted[i];
            break;
          }
        }
        slices.push({ start: offset, end: cut });
        offset = cut;
      }

      slices.forEach(({ start, end }, pageIdx) => {
        if (pageIdx > 0) pdf.addPage();
        const sliceH = end - start;
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(
          canvas,
          0, start, canvas.width, sliceH,
          0, 0,     canvas.width, sliceH,
        );
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN, MARGIN,
          CONTENT_W, sliceH * mmPerPx,
        );
      });
    } finally {
      document.body.removeChild(host);
    }

    pdf.save(filename);
  } catch (err) {
    console.error("PDF export failed", err);
    throw new Error(
      err instanceof Error ? `PDF export failed: ${err.message}` : "PDF export failed",
    );
  }
}
