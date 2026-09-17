export const mediaTypes = ["image/jpeg", "image/webp"] as const;

export type MediaType = (typeof mediaTypes)[number];

export const mediaLimits = {
	maxBytes: 4 * 1024 * 1024,
	photoMaxSide: 2048,
	photoQuality: 0.82,
	thumbnailMaxSide: 512,
	thumbnailQuality: 0.8,
} as const;

export const mediaHashPattern = /^[0-9a-f]{64}$/;

const jpegSignature = [0xff, 0xd8, 0xff];
const riffSignature = [0x52, 0x49, 0x46, 0x46];
const webpSignature = [0x57, 0x45, 0x42, 0x50];
const vp8Signature = [0x56, 0x50, 0x38];
const riffHeaderLength = 8;
const webpMinimumLength = 15;

function hasBytesAt(bytes: Uint8Array, offset: number, expected: number[]) {
	return expected.every((value, index) => bytes[offset + index] === value);
}

export function detectMediaType(bytes: Uint8Array): MediaType | null {
	if (hasBytesAt(bytes, 0, jpegSignature)) {
		return "image/jpeg";
	}
	if (
		bytes.byteLength < webpMinimumLength ||
		!hasBytesAt(bytes, 0, riffSignature) ||
		!hasBytesAt(bytes, 8, webpSignature) ||
		!hasBytesAt(bytes, 12, vp8Signature)
	) {
		return null;
	}
	const declared = new DataView(
		bytes.buffer,
		bytes.byteOffset,
		bytes.byteLength
	).getUint32(4, true);
	return declared + riffHeaderLength === bytes.byteLength ? "image/webp" : null;
}

export function mediaExtension(type: MediaType): "jpg" | "webp" {
	return type === "image/jpeg" ? "jpg" : "webp";
}

export function fitWithin(
	width: number,
	height: number,
	maxSide: number
): { height: number; width: number } {
	const larger = Math.max(width, height);
	if (larger <= maxSide) {
		return { height, width };
	}
	const scale = maxSide / larger;
	return {
		height: Math.max(1, Math.round(height * scale)),
		width: Math.max(1, Math.round(width * scale)),
	};
}
