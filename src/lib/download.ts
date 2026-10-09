/** Prepare a local URL before a native download click. The owner revokes it. */
export function createDownloadUrl(blob: Blob): string {
  if (blob.size === 0) throw new Error("The file is empty. Please press it again.");
  return URL.createObjectURL(blob);
}
