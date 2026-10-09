import { pressedName } from "@/lib/format";
import { compressImage, type ImageEncode } from "./image";
import type { CompressResult, PressMode, ProgressFn } from "./types";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tif|tiff)$/i;
const XML_EXT = /\.(xml|rels)$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function minifyXml(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

export async function compressDocx(
  file: File,
  mode: PressMode,
  onProgress: ProgressFn,
): Promise<CompressResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files).filter((path) => !zip.files[path]?.dir);
  const media = paths.filter((path) => path.startsWith("word/media/") && IMAGE_EXT.test(path));
  const xmls = paths.filter((path) => XML_EXT.test(path));

  let step = 0;
  const total = Math.max(1, media.length + xmls.length + 1);
  const bump = () => {
    step += 1;
    onProgress(Math.min(0.94, step / total));
  };

  for (const path of media) {
    const entry = zip.files[path];
    if (!entry) continue;
    try {
      const blob = await entry.async("blob");
      const name = path.split("/").pop() ?? "image.png";
      const encodeAs = encodeForDocx(name);
      const fake = new File([blob], name, { type: blob.type || mimeFor(encodeAs) });
      const pressed = await compressImage(fake, mode, () => {}, encodeAs);
      if (!pressed.keptOriginal && pressed.blob.size < blob.size) {
        zip.file(path, pressed.blob);
      }
    } catch {
      // Keep the original embedded image if it cannot be re-encoded.
    }
    bump();
  }

  for (const path of xmls) {
    const entry = zip.files[path];
    if (!entry) continue;
    try {
      const xml = await entry.async("string");
      zip.file(path, minifyXml(xml));
    } catch {
      // Leave the XML as-is.
    }
    bump();
  }

  const out = await zip.generateAsync({
    type: "blob",
    mimeType: DOCX_MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  onProgress(0.98);

  if (out.size >= file.size) {
    return { blob: file, filename: file.name, keptOriginal: true };
  }
  return { blob: out, filename: pressedName(file.name, "docx"), keptOriginal: false };
}

function encodeForDocx(name: string): ImageEncode {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  return "png";
}

function mimeFor(encodeAs: ImageEncode): string {
  if (encodeAs === "jpeg") return "image/jpeg";
  if (encodeAs === "webp") return "image/webp";
  return "image/png";
}
