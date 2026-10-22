/**
 * Audit H1: every upload is re-encoded through a canvas, which drops EXIF/GPS
 * metadata. Browser APIs are stubbed to observe what reencodeImage does.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitWithin, reencodeImage } from "../../src/lib/image";

type Drawn = { w: number; h: number; type?: string };

function stubBrowser(decodable: boolean) {
  const calls: Drawn[] = [];
  const g = globalThis as Record<string, unknown>;
  g.createImageBitmap = async () => {
    if (!decodable) throw new Error("decode failed");
    return { width: 4000, height: 3000, close() {} };
  };
  g.document = {
    createElement: () => {
      const c = {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: "", fillRect() {}, drawImage() {} }),
        toBlob: (cb: (b: Blob) => void, type: string) => {
          calls.push({ w: c.width, h: c.height, type });
          cb(new Blob([new Uint8Array(10)], { type }));
        },
      };
      return c;
    },
  };
  return calls;
}

describe("reencodeImage", () => {
  it("always produces a fresh JPEG from a canvas, even for small files", async () => {
    const calls = stubBrowser(true);
    const small = new Blob([new Uint8Array(1000)], { type: "image/jpeg" }); // original carries EXIF
    const out = await reencodeImage(small);
    assert.notEqual(out, small, "must not return the original file");
    assert.equal(out.type, "image/jpeg");
    assert.deepEqual(calls, [{ w: 1600, h: 1200, type: "image/jpeg" }]);
  });

  it("rejects files the browser can't decode instead of uploading them raw", async () => {
    stubBrowser(false);
    await assert.rejects(reencodeImage(new Blob(["x"], { type: "image/heic" })), /isn't supported/);
  });

  it("fits within the maximum side without upscaling", () => {
    assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
    assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
    assert.deepEqual(fitWithin(10000, 1, 512), { width: 512, height: 1 });
  });
});
