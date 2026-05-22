import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

// Renders the full element as one HD canvas then slices it into A4 pages.
// This avoids per-section html2canvas issues (flex layout, list markers, etc.)
// that caused the last few questions to lose styling.
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  try {
    if (typeof document !== "undefined" && (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts) {
      try { await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready; } catch {}
    }

    const CLONE_WIDTH_PX = 820;
    const clone = el.cloneNode(true) as HTMLElement;
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${CLONE_WIDTH_PX}px;background:#ffffff;`;
    clone.style.cssText += `;width:${CLONE_WIDTH_PX}px;max-width:none;margin:0;box-shadow:none;border-radius:0;`;
    host.appendChild(clone);
    document.body.appendChild(host);
    await new Promise((r) => setTimeout(r, 100));

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

      // Find safe page-break positions between data-pdf-section elements
      // so we avoid cutting through the middle of a question where possible.
      const sectionEls = Array.from(clone.querySelectorAll<HTMLElement>("[data-pdf-section]"));
      const safeBreaks = new Set<number>([0]);
      for (const sec of sectionEls) {
        const top = Math.round(sec.getBoundingClientRect().top - host.getBoundingClientRect().top);
        safeBreaks.add(Math.max(0, top * SCALE));
      }
      const breaksSorted = Array.from(safeBreaks).sort((a, b) => a - b);

      // Build page slices: try to cut at a safe break just before the page boundary.
      const slices: { start: number; end: number }[] = [];
      let offset = 0;
      while (offset < canvas.height) {
        const ideal = offset + pagePxH;
        if (ideal >= canvas.height) {
          slices.push({ start: offset, end: canvas.height });
          break;
        }
        // Find the latest safe break that is <= ideal
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
        const sliceHmm = sliceH * mmPerPx;
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN,
          MARGIN,
          CONTENT_W,
          sliceHmm,
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
