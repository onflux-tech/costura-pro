import { describe, expect, test } from "bun:test";

import {
	detectMediaType,
	fitWithin,
	mediaExtension,
	mediaHashPattern,
	mediaLimits,
} from "./media";

function webp(totalLength: number, declared = totalLength - 8) {
	const bytes = new Uint8Array(totalLength);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0);
	new DataView(bytes.buffer).setUint32(4, declared, true);
	bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38], 8);
	return bytes;
}

describe("detectMediaType", () => {
	test("recognizes JPEG and WebP by their bytes", () => {
		expect(detectMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(
			"image/jpeg"
		);
		expect(detectMediaType(webp(40))).toBe("image/webp");
	});

	test("refuses PNG, empty, truncated WebP and a WebP with the wrong size", () => {
		const png = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		expect(detectMediaType(png)).toBeNull();
		expect(detectMediaType(new Uint8Array())).toBeNull();
		expect(detectMediaType(webp(40).slice(0, 12))).toBeNull();
		expect(detectMediaType(webp(40, 40))).toBeNull();
		const otherChunk = webp(40);
		otherChunk.set([0x58, 0x58, 0x58], 12);
		expect(detectMediaType(otherChunk)).toBeNull();
	});
});

describe("fitWithin", () => {
	test("scales the larger side down and keeps the proportion", () => {
		expect(fitWithin(4032, 3024, 2048)).toEqual({ height: 1536, width: 2048 });
		expect(fitWithin(3024, 4032, 512)).toEqual({ height: 512, width: 384 });
	});

	test("never enlarges and never reaches zero", () => {
		expect(fitWithin(800, 600, 2048)).toEqual({ height: 600, width: 800 });
		expect(fitWithin(10_000, 2, 2048)).toEqual({ height: 1, width: 2048 });
	});
});

describe("media constants", () => {
	test("accepts only lowercase SHA-256 hex and maps extensions", () => {
		expect(mediaHashPattern.test("a".repeat(64))).toBe(true);
		expect(mediaHashPattern.test("A".repeat(64))).toBe(false);
		expect(mediaHashPattern.test("a".repeat(63))).toBe(false);
		expect(mediaExtension("image/jpeg")).toBe("jpg");
		expect(mediaExtension("image/webp")).toBe("webp");
		expect(mediaLimits).toEqual({
			maxBytes: 4 * 1024 * 1024,
			photoMaxSide: 2048,
			photoQuality: 0.82,
			thumbnailMaxSide: 512,
			thumbnailQuality: 0.8,
		});
	});
});
