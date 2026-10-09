import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { createArchive } from "./archive.ts";

test("ZIP preserves every file, including duplicate and colliding filenames", async () => {
  const names = ["copy.pdf", "copy.pdf", "copy-1.pdf", "COPY.PDF", "folder/file.pdf", "..", ""];
  const files = names.map((filename, index) => ({
    filename,
    blob: new Blob([`payload-${index}`]),
  }));
  const blob = await createArchive(files);
  assert.equal(blob.type, "application/zip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entries = Object.values(zip.files);
  assert.equal(entries.length, files.length);
  assert.equal(new Set(entries.map((entry) => entry.name.toLowerCase())).size, files.length);
  assert.ok(entries.every((entry) => !entry.dir && !entry.name.includes("/")));
  const payloads = await Promise.all(entries.map((entry) => entry.async("string")));
  assert.deepEqual(
    payloads,
    files.map((_, index) => `payload-${index}`),
  );
});

test("ZIP preserves binary bytes", async () => {
  const bytes = new Uint8Array([0, 128, 255, 5, 13, 10]);
  const archive = await createArchive([{ filename: "sample.bin", blob: new Blob([bytes]) }]);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  assert.deepEqual(await zip.file("sample.bin")!.async("uint8array"), bytes);
});

test("ZIP rejects empty batches and empty files", async () => {
  await assert.rejects(createArchive([]), /no files/);
  await assert.rejects(
    createArchive([{ filename: "empty.pdf", blob: new Blob() }]),
    /empty.pdf is empty/,
  );
});
