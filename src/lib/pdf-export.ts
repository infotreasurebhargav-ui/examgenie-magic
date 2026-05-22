import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  try {
    if (document.fonts) {
      try { await document.fonts.ready; } catch {}
    }

    const CLONE_WIDTH_PX = 820;

    // Clone so we can restyle without touching the live preview
    const clone = el.cloneNode(true) as HTMLElement;

    // Place the clone just off the LEFT edge of the viewport (fixed, not far-off).
    // IMPORTANT: never use opacity:0 or visibility:hidden — html2canvas computes
    // inherited opacity and renders everything transparent if a parent is opacity:0.
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

    // Style the inner paper element for clean PDF output
    const paper = clone.querySelector<HTMLElement>(".paper-sheet") ?? clone;
    paper.style.width = `${CLONE_WIDTH_PX}px`;
    paper.style.maxWidth = "none";
    paper.style.margin = "0";
    paper.style.boxShadow = "none";
    paper.style.borderRadius = "0";

    // Two rAF + 300 ms: lets the browser fully paint, resolve CSS vars and fonts
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await new Promise((r) => setTimeout(r, 300));

    const A4_W = 210;
    const A4_H = 297;
    const MARGIN = 12;
    const CONTENT_W = A4_W - MARGIN * 2;
    const CONTENT_H = A4_H - MARGIN * 2;
    const SCALE = 3;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    try {
      const canvas = await html2canvas(paper, {
        scale: SCALE,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: CLONE_WIDTH_PX,
      });

      const mmPerPx = CONTENT_W / canvas.width;
      const pagePxH = Math.floor(CONTENT_H / mmPerPx);

      // Compute safe page-break positions relative to the paper element
      const paperRect = paper.getBoundingClientRect();
      const sectionEls = Array.from(paper.querySelectorAll<HTMLElement>("[data-pdf-section]"));
      const safeBreaks = new Set<number>([0]);
      for (const sec of sectionEls) {
        const top = Math.round((sec.getBoundingClientRect().top - paperRect.top) * SCALE);
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
        ctx.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN,
          MARGIN,
          CONTENT_W,
          sliceH * mmPerPx,
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
