export type PressMode = "balanced" | "strong";
export type FileKind = "image" | "video" | "pdf" | "docx";

export type CompressResult = {
  blob: Blob;
  filename: string;
  keptOriginal: boolean;
};

export type ProgressFn = (ratio: number) => void;

export const MAX_BYTES = 1024 * 1024 * 1024;
