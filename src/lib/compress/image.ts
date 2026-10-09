import { pressedName, stemAndExt } from "@/lib/format";
import { IMAGE_PRESET } from "./presets";
import type { CompressResult, PressMode, ProgressFn } from "./types";

export type ImageEncode = "webp" | "jpeg" | "png";

type Candidate = {
  blob: Blob;
  ext: string;
  quality: number;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode this image."));
      },
      type,
      quality,
    );
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not read this image."));
        img.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function hasVisibleAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const step = Math.max(1, Math.floor(Math.min(width, height) / 48));
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[(y * width + x) * 4 + 3] < 250) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function pickCandidate(
  candidates: Candidate[],
  originalSize: number,
  mode: PressMode,
): Candidate | null {
  const smaller = candidates.filter((item) => item.blob.size < originalSize && item.blob.size > 0);
  if (!smaller.length) return null;
  if (mode === "balanced") {
    const enough = smaller.filter((item) => item.blob.size <= originalSize * 0.95);
    const pool = enough.length ? enough : smaller;
    pool.sort((a, b) => b.quality - a.quality || a.blob.size - b.blob.size);
    return pool[0] ?? null;
  }
  smaller.sort((a, b) => a.blob.size - b.blob.size);
  return smaller[0] ?? null;
}

export async function compressImage(
  file: File,
  mode: PressMode,
  onProgress: ProgressFn,
  encodeAs?: ImageEncode,
): Promise<CompressResult> {
  const preset = IMAGE_PRESET[mode];
  onProgress(0.08);
  const bitmap = await loadBitmap(file);
  try {
    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, preset.maxEdge / maxDim);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!ctx) throw new Error("Could not open a drawing surface.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    onProgress(0.4);

    const originalExt = stemAndExt(file.name).ext;
    const jpegSource = originalExt === "jpg" || originalExt === "jpeg" || file.type === "image/jpeg";
    const alpha = encodeAs === "jpeg" || jpegSource ? false : hasVisibleAlpha(ctx, width, height);

    const types: { mime: string; ext: string }[] = [];
    if (encodeAs === "png") types.push({ mime: "image/png", ext: "png" });
    else if (encodeAs === "jpeg") types.push({ mime: "image/jpeg", ext: "jpg" });
    else if (encodeAs === "webp") types.push({ mime: "image/webp", ext: "webp" });
    else {
      types.push({ mime: "image/webp", ext: "webp" });
      if (!alpha) types.push({ mime: "image/jpeg", ext: "jpg" });
    }

    const candidates: Candidate[] = [];
    const qualities = encodeAs === "png" ? [1] : preset.qualities;
    let step = 0;
    const total = Math.max(1, types.length * qualities.length);

    for (const type of types) {
      if (type.mime === "image/jpeg") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      for (const quality of qualities) {
        try {
          const blob = await canvasToBlob(
            canvas,
            type.mime,
            type.mime === "image/png" ? undefined : quality,
          );
          candidates.push({ blob, ext: type.ext, quality });
        } catch {
          // skip unsupported encoder
        }
        step += 1;
        onProgress(0.4 + (0.5 * step) / total);
      }
    }

    const best = pickCandidate(candidates, file.size, mode);
    onProgress(0.96);
    if (!best) {
      return { blob: file, filename: file.name, keptOriginal: true };
    }
    return { blob: best.blob, filename: pressedName(file.name, best.ext), keptOriginal: false };
  } finally {
    bitmap.close();
  }
}
