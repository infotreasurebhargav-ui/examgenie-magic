import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

// Professional section-aware PDF export.
// - Renders each [data-pdf-section] separately at HD scale
// - Keeps each section intact on a page (no mid-question cuts)
// - If a section is taller than a full page, falls back to slicing that
//   single section across pages (rare; only for very long blocks)
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  try {
    // Clone the element offscreen at a fixed A4-friendly width so layout is
    // deterministic regardless of the user's viewport.
    const CLONE_WIDTH_PX = 820; // matches PaperSheet max width
    const clone = el.cloneNode(true) as HTMLElement;
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${CLONE_WIDTH_PX}px;background:#ffffff;`;
    clone.style.width = `${CLONE_WIDTH_PX}px`;
    clone.style.maxWidth = "none";
    clone.style.margin = "0";
    clone.style.boxShadow = "none";
    clone.style.borderRadius = "0";
    host.appendChild(clone);
    document.body.appendChild(host);

    // A4 in mm
    const A4_W = 210;
    const A4_H = 297;
    const MARGIN = 12;
    const CONTENT_W = A4_W - MARGIN * 2;
    const CONTENT_H = A4_H - MARGIN * 2;
    const GAP = 3;
    const SCALE = 3; // HD

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const sections = Array.from(
      clone.querySelectorAll<HTMLElement>("[data-pdf-section]"),
    );
    const targets: HTMLElement[] = sections.length ? sections : [clone];

    let y = MARGIN;
    let firstOnPage = true;

    const renderSection = async (node: HTMLElement) => {
      const canvas = await html2canvas(node, {
        scale: SCALE,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const widthPx = canvas.width;
      const mmPerPx = CONTENT_W / widthPx;
      const heightMM = canvas.height * mmPerPx;

      // Case 1: fits on the rest of current page
      const remaining = A4_H - MARGIN - y;
      if (heightMM <= remaining) {
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN,
          y,
          CONTENT_W,
          heightMM,
        );
        y += heightMM + GAP;
        firstOnPage = false;
        return;
      }

      // Case 2: fits on a full page → start a new page (unless already empty)
      if (heightMM <= CONTENT_H) {
        if (!firstOnPage) {
          pdf.addPage();
          y = MARGIN;
        }
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN,
          y,
          CONTENT_W,
          heightMM,
        );
        y += heightMM + GAP;
        firstOnPage = false;
        return;
      }

      // Case 3: section taller than a page → slice it across pages.
      if (!firstOnPage) {
        pdf.addPage();
        y = MARGIN;
      }
      const pagePxHeight = Math.floor(CONTENT_H / mmPerPx);
      let offset = 0;
      while (offset < canvas.height) {
        const sliceH = Math.min(pagePxHeight, canvas.height - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH,
        );
        const sliceHmm = sliceH * mmPerPx;
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN,
          MARGIN,
          CONTENT_W,
          sliceHmm,
        );
        offset += sliceH;
        if (offset < canvas.height) {
          pdf.addPage();
        }
        y = MARGIN + sliceHmm + GAP;
        firstOnPage = false;
      }
    };

    try {
      for (const t of targets) {
        await renderSection(t);
      }
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
