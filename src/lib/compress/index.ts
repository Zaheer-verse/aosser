import type { CompressResult, FileKind, PressMode, ProgressFn } from "./types";

export type { CompressResult, FileKind, PressMode, ProgressFn } from "./types";
export { MAX_BYTES } from "./types";
export { detectKind, kindLabel, ACCEPT_ATTR } from "./detect";

export async function compressFile(
  file: File,
  kind: FileKind,
  mode: PressMode,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<CompressResult> {
  if (signal?.aborted) {
    throw new DOMException("Compression canceled.", "AbortError");
  }
  switch (kind) {
    case "image": {
      const { compressImage } = await import("./image");
      return compressImage(file, mode, onProgress);
    }
    case "pdf": {
      const { compressPdf } = await import("./pdf");
      return compressPdf(file, mode, onProgress);
    }
    case "docx": {
      const { compressDocx } = await import("./docx");
      return compressDocx(file, mode, onProgress);
    }
    case "video": {
      const { compressVideo } = await import("./video");
      return compressVideo(file, mode, onProgress, signal);
    }
  }
}
