export type ArchiveFile = { blob: Blob; filename: string };

/** Build the archive first; downloading happens on a separate, native click. */
export async function createArchive(files: ArchiveFile[]): Promise<Blob> {
  if (files.length === 0) throw new Error("There are no files to download.");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files) {
    if (file.blob.size === 0) throw new Error(`${file.filename} is empty. Please press it again.`);
    // Keep entries at the archive root, including unusual input filenames.
    const base = file.filename
      .replace(/[\\/]/g, "_")
      .replace(/\p{Cc}/gu, "_")
      .trim();
    const filename = base && base !== "." && base !== ".." ? base : "file";
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";
    let name = filename;
    let suffix = 1;
    while (used.has(name.toLowerCase())) name = `${stem}-${suffix++}${ext}`;
    used.add(name.toLowerCase());
    zip.file(name, await file.blob.arrayBuffer());
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/zip", compression: "STORE" });
}
