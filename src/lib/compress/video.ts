import { pressedName } from "@/lib/format";
import { VIDEO_PRESET } from "./presets";
import type { CompressResult, PressMode, ProgressFn } from "./types";

type VideoCodec = "avc" | "vp9" | "vp8" | "av1";
type AudioCodec = "aac" | "opus";

export async function compressVideo(
  file: File,
  mode: PressMode,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<CompressResult> {
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    ConversionCanceledError,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
    WebMOutputFormat,
    canEncodeAudio,
    canEncodeVideo,
  } = await import("mediabunny");

  const preset = VIDEO_PRESET[mode];
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  let conversion: Awaited<ReturnType<typeof Conversion.init>> | null = null;

  const abort = async () => {
    try {
      await conversion?.cancel();
    } catch {
      // already finished or canceled
    }
  };
  signal?.addEventListener("abort", () => {
    void abort();
  });

  try {
    if (!(await input.canRead())) {
      throw new Error("This video format cannot be read in the browser.");
    }

    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!videoTrack && !audioTrack) {
      throw new Error("No playable video or audio track was found.");
    }

    const displayHeight = videoTrack ? await videoTrack.getDisplayHeight() : 720;
    const displayWidth = videoTrack ? await videoTrack.getDisplayWidth() : 1280;
    const targetHeight = Math.min(displayHeight, preset.maxHeight);
    const scale = targetHeight / displayHeight;
    const targetWidth = Math.max(2, Math.round((displayWidth * scale) / 2) * 2);
    const evenHeight = Math.max(2, Math.round(targetHeight / 2) * 2);

    const mp4Video: VideoCodec[] = ["avc", "vp9"];
    const webmVideo: VideoCodec[] = ["vp9", "vp8", "av1"];
    let container: "mp4" | "webm" = "mp4";
    let videoCodec: VideoCodec | undefined;
    for (const codec of mp4Video) {
      if (await canEncodeVideo(codec, { width: targetWidth, height: evenHeight })) {
        videoCodec = codec;
        container = "mp4";
        break;
      }
    }
    if (!videoCodec) {
      for (const codec of webmVideo) {
        if (await canEncodeVideo(codec, { width: targetWidth, height: evenHeight })) {
          videoCodec = codec;
          container = "webm";
          break;
        }
      }
    }
    if (videoTrack && !videoCodec) {
      throw new Error("This browser cannot encode video. Try Chrome, Edge, or Safari.");
    }

    let audioCodec: AudioCodec | undefined;
    const audioOrder: AudioCodec[] = container === "mp4" ? ["aac", "opus"] : ["opus", "aac"];
    for (const codec of audioOrder) {
      if (await canEncodeAudio(codec)) {
        audioCodec = codec;
        break;
      }
    }

    const target = new BufferTarget();
    const format =
      container === "mp4"
        ? new Mp4OutputFormat({
            fastStart: file.size > 80 * 1024 * 1024 ? "fragmented" : "in-memory",
          })
        : new WebMOutputFormat();
    const output = new Output({ format, target });

    conversion = await Conversion.init({
      input,
      output,
      copy: false,
      showWarnings: false,
      video: videoTrack
        ? {
            codec: videoCodec,
            height: evenHeight,
            fit: "contain",
            quality: new Quality({ quality: preset.quality, preferBitrate: true }),
            forceTranscode: true,
            hardwareAcceleration: "no-preference",
          }
        : { discard: true },
      audio: audioTrack
        ? audioCodec
          ? {
              codec: audioCodec,
              quality: new Quality({ quality: preset.audioQuality, preferBitrate: true }),
              forceTranscode: true,
            }
          : { discard: true }
        : { discard: true },
    });

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((item) => item.reason.replaceAll("_", " "))
        .join("; ");
      throw new Error(
        reasons
          ? `Could not compress this video (${reasons}).`
          : "Could not compress this video in this browser.",
      );
    }

    conversion.onProgress = (progress) => {
      onProgress(Math.min(0.97, Math.max(0.04, progress)));
    };

    if (signal?.aborted) {
      await conversion.cancel();
    }

    await conversion.execute();

    const buffer = target.buffer;
    if (!buffer) throw new Error("The encoder finished without writing a file.");
    const mime = container === "mp4" ? "video/mp4" : "video/webm";
    const blob = new Blob([buffer], { type: mime });
    onProgress(0.99);
    if (blob.size >= file.size) {
      return { blob: file, filename: file.name, keptOriginal: true };
    }
    return {
      blob,
      filename: pressedName(file.name, container === "mp4" ? "mp4" : "webm"),
      keptOriginal: false,
    };
  } catch (err) {
    if (err instanceof ConversionCanceledError) {
      throw new DOMException("Compression canceled.", "AbortError");
    }
    throw err;
  } finally {
    input.dispose();
  }
}
