#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import JSZip from "jszip";
import { checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "screenshots", "downloads");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const mode of ["desktop", "mobile", "embedded"]) {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: mode === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      ...(mode === "mobile" ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    const uploadRequests = [];
    context.on("request", (request) => {
      if (/^https?:/.test(request.url()) && ["POST", "PUT", "PATCH"].includes(request.method())) {
        uploadRequests.push({ method: request.method(), url: request.url() });
      }
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(url, { waitUntil: "networkidle" });
    let surface = page;
    if (mode === "embedded") {
      await page.setContent(
        `<iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-downloads" style="width:100%;height:760px;border:0"></iframe>`,
      );
      await page
        .frameLocator("iframe")
        .getByRole("heading", { name: "Compress files. Keep control." })
        .waitFor();
      surface = page.frames().find((frame) => frame.parentFrame());
      assert.ok(surface);
    }
    assert.equal(
      await surface.locator('script[src*="grok-app-builder/extensions.js"]').count(),
      0,
      "standalone Aosser configuration must not inject the platform badge",
    );
    assert.equal(
      await surface.locator('a[href*="github.com"]').count(),
      0,
      "product UI must not expose repository links",
    );
    assert.doesNotMatch(
      await surface.locator("body").innerText(),
      /github|open source|repository/i,
      "product UI must not expose repository information",
    );
    const balanced = surface.getByRole("radio", { name: /^Balanced/ });
    const strong = surface.getByRole("radio", { name: /^Strong/ });
    assert.equal(await balanced.isChecked(), true);
    await balanced.press("ArrowRight");
    assert.equal(
      await strong.isChecked(),
      true,
      "compression presets must support keyboard navigation",
    );
    await strong.press("ArrowLeft");
    assert.equal(await balanced.isChecked(), true);
    const fixture = await surface.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      const pixels = ctx.createImageData(640, 480);
      for (let i = 0; i < pixels.data.length; i += 4) {
        pixels.data[i] = (i * 37) % 256;
        pixels.data[i + 1] = (i * 11) % 256;
        pixels.data[i + 2] = (i * 3) % 256;
        pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const input = {
      name: "sample.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    };
    await surface.locator('input[type="file"]').setInputFiles(input);
    await surface.getByRole("button", { name: "Press 1 file", exact: true }).click();
    const card = surface.locator("article a[download]").first();
    await card.waitFor({ state: "visible" });
    const comparison = surface.getByRole("slider", { name: "Compare original and pressed" });
    await comparison.press("Home");
    assert.equal(await comparison.getAttribute("aria-valuenow"), "0");
    await comparison.press("End");
    assert.equal(await comparison.getAttribute("aria-valuenow"), "100");
    await comparison.press("ArrowLeft");
    assert.equal(await comparison.getAttribute("aria-valuenow"), "96");
    const expected = await surface.evaluate(async () => {
      const link = document.querySelector("article a[download]");
      return {
        name: link.download,
        bytes: [...new Uint8Array(await (await fetch(link.href)).arrayBuffer())],
      };
    });
    const save = async (link, label) => {
      const pending = page.waitForEvent("download");
      await link.click();
      const download = await pending;
      assert.equal(await download.failure(), null, `${mode} ${label} download failed`);
      const bytes = await readFile(await download.path());
      assert.ok(bytes.length > 0);
      assert.equal(page.url(), url, "download navigated away from the app");
      return { download, bytes };
    };
    const individual = await save(card, "card");
    assert.equal(individual.download.suggestedFilename(), expected.name);
    assert.deepEqual([...individual.bytes], expected.bytes);
    const dock = await save(surface.getByRole("link", { name: "Save file", exact: true }), "dock");
    assert.deepEqual(dock.bytes, individual.bytes);
    await surface.locator('input[type="file"]').setInputFiles(input);
    await surface.getByRole("button", { name: "Press 1 file", exact: true }).click();
    await surface.getByRole("button", { name: "Prepare ZIP", exact: true }).waitFor();
    await surface.getByRole("button", { name: "Prepare ZIP", exact: true }).click();
    const zipLink = surface.getByRole("link", { name: "Download all", exact: true });
    await zipLink.waitFor({ state: "visible" });
    const firstZipUrl = await zipLink.getAttribute("href");
    // Deliberately wait beyond transient activation from the preparation click.
    await page.waitForTimeout(5500);
    await page.screenshot({ path: join(output, `${mode}-ready.png`), fullPage: true });
    const archiveDownload = await save(zipLink, "archive");
    assert.equal(archiveDownload.download.suggestedFilename(), "aosser-pressed.zip");
    const zip = await JSZip.loadAsync(archiveDownload.bytes);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map((entry) => entry.name)).size, 2);
    for (const entry of entries)
      assert.deepEqual(Buffer.from(await entry.async("uint8array")), individual.bytes);
    await surface.getByRole("button", { name: "Remove sample.png", exact: true }).first().click();
    await zipLink.waitFor({ state: "detached" });
    assert.equal(
      await surface.evaluate(async (oldUrl) => {
        try {
          await fetch(oldUrl);
          return false;
        } catch {
          return true;
        }
      }, firstZipUrl),
      true,
      "old archive URL was not released",
    );
    // Failed fetch above is intentional and may log a network error.
    const unexpected = errors.filter((error) => !error.includes("ERR_FILE_NOT_FOUND"));
    assert.deepEqual(unexpected, []);
    assert.deepEqual(uploadRequests, [], "local compression must not send upload requests");
    assert.equal(
      await surface.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      ),
      false,
    );
    results.push({
      mode,
      file: expected.name,
      bytes: individual.bytes.length,
      archiveEntries: entries.map((entry) => entry.name),
      downloads: 3,
      staleArchiveReleased: true,
      consoleErrors: unexpected,
      uploadRequests: uploadRequests.length,
      keyboardPresets: true,
      platformBadge: false,
    });
    await context.close();
  }
  const verdict = { ok: true, url, results };
  await writeFile(
    join(output, `verdict-${new URL(url).port}.json`),
    JSON.stringify(verdict, null, 2),
  );
  console.log(JSON.stringify(verdict, null, 2));
} finally {
  await browser.close();
}
