import { pressedName } from "@/lib/format";
import { PDF_PRESET } from "./presets";
import type { CompressResult, PressMode, ProgressFn } from "./types";

let workerReady = false;

function fitScale(width: number, height: number, dpi: number, maxEdge: number) {
  let scale = dpi / 72;
  const longEdge = Math.max(width, height) * scale;
  if (longEdge > maxEdge) scale *= maxEdge / longEdge;
  return scale;
}

async function pageHasText(page: {
  getTextContent: () => Promise<{ items: readonly unknown[] }>;
}): Promise<boolean> {
  try {
    const content = await page.getTextContent();
    let length = 0;
    for (const item of content.items) {
      if (item && typeof item === "object" && "str" in item && typeof item.str === "string") {
        length += item.str.trim().length;
      }
    }
    return length > 20;
  } catch {
    return false;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function compressPdf(
  file: File,
  mode: PressMode,
  onProgress: ProgressFn,
): Promise<CompressResult> {
  const preset = PDF_PRESET[mode];
  const pdfjs = await import("pdfjs-dist");
  const { PDFDocument } = await import("pdf-lib");

  if (!workerReady) {
    const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    workerReady = true;
  }

  onProgress(0.04);
  const url = URL.createObjectURL(file);
  const loadingTask = pdfjs.getDocument({
    url,
    disableRange: false,
    disableStream: false,
  });
  try {
    const pdf = await loadingTask.promise;
    const outDoc = await PDFDocument.create();
    const pageCount = pdf.numPages;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!ctx) throw new Error("Could not open a drawing surface.");

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const unscaled = page.getViewport({ scale: 1 });
      const hasText = await pageHasText(page);
      const dpi = hasText ? preset.textDpi : preset.scanDpi;
      const quality = hasText ? preset.textQuality : preset.scanQuality;
      const scale = fitScale(unscaled.width, unscaled.height, dpi, preset.maxEdge);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      const jpeg = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode a page."))),
          "image/jpeg",
          quality,
        );
      });
      const bytes = new Uint8Array(await jpeg.arrayBuffer());
      const image = await outDoc.embedJpg(bytes);
      const nextPage = outDoc.addPage([unscaled.width, unscaled.height]);
      nextPage.drawImage(image, {
        x: 0,
        y: 0,
        width: unscaled.width,
        height: unscaled.height,
      });
      page.cleanup();
      onProgress(0.08 + (0.84 * i) / pageCount);
    }

    canvas.width = 0;
    canvas.height = 0;
    await pdf.cleanup();

    const saved = await outDoc.save({ useObjectStreams: true });
    const blob = new Blob([toArrayBuffer(saved)], { type: "application/pdf" });
    onProgress(0.98);
    if (blob.size >= file.size) {
      return { blob: file, filename: file.name, keptOriginal: true };
    }
    return { blob, filename: pressedName(file.name, "pdf"), keptOriginal: false };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
    URL.revokeObjectURL(url);
  }
}
