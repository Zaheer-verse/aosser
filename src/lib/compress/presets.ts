import type { PressMode } from "./types";

export type ImagePreset = {
  maxEdge: number;
  qualities: number[];
};

export type PdfPreset = {
  scanDpi: number;
  scanQuality: number;
  textDpi: number;
  textQuality: number;
  maxEdge: number;
};

export type VideoPreset = {
  maxHeight: number;
  quality: number;
  audioQuality: number;
};

export const IMAGE_PRESET: Record<PressMode, ImagePreset> = {
  balanced: { maxEdge: 2560, qualities: [0.9, 0.84, 0.78] },
  strong: { maxEdge: 1920, qualities: [0.72, 0.64, 0.56] },
};

export const PDF_PRESET: Record<PressMode, PdfPreset> = {
  balanced: { scanDpi: 150, scanQuality: 0.8, textDpi: 220, textQuality: 0.9, maxEdge: 2800 },
  strong: { scanDpi: 110, scanQuality: 0.62, textDpi: 160, textQuality: 0.78, maxEdge: 2000 },
};

export const VIDEO_PRESET: Record<PressMode, VideoPreset> = {
  balanced: { maxHeight: 1080, quality: 0.68, audioQuality: 0.62 },
  strong: { maxHeight: 720, quality: 0.42, audioQuality: 0.42 },
};
