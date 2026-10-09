import type { FileKind } from "./types";

const IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
  "svg",
  "tif",
  "tiff",
  "heic",
  "heif",
]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "mkv", "m4v", "ogv", "qt"]);
const PDF_EXT = new Set(["pdf"]);
const DOCX_EXT = new Set(["docx"]);

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function detectKind(file: File): FileKind | null {
  const ext = extOf(file.name);
  const mime = file.type.toLowerCase();

  if (DOCX_EXT.has(ext) || mime.includes("wordprocessingml.document")) return "docx";
  if (PDF_EXT.has(ext) || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/") || IMAGE_EXT.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXT.has(ext)) return "video";
  return null;
}

export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
  }
}

export const ACCEPT_ATTR = [
  "image/*",
  "video/*",
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".svg",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".m4v",
].join(",");
