import assert from "node:assert/strict";
import { test } from "node:test";
import { createDownloadUrl } from "./download.ts";

test("download URL retains the exact file bytes and MIME type", async () => {
  const bytes = new Uint8Array([0, 1, 128, 255, 13, 10]);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = createDownloadUrl(blob);
  try {
    const response = await fetch(url);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  } finally {
    URL.revokeObjectURL(url);
  }
});

test("empty output is rejected instead of offering a broken download", () => {
  assert.throws(() => createDownloadUrl(new Blob()), /file is empty/);
});
