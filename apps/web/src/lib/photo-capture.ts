import {
	fitWithin,
	type MediaType,
	mediaLimits,
} from "@costura-pro/domain/media";

import { PhotoCaptureError } from "./photo-capture-error";

export type PreparedFile = { blob: Blob; hash: string; type: MediaType };

export type PreparedPhoto = { photo: PreparedFile; thumbnail: PreparedFile };

function decode(file: File): Promise<ImageBitmap> {
	return createImageBitmap(file, { imageOrientation: "from-image" }).catch(
		() => {
			throw new PhotoCaptureError("decode");
		}
	);
}

function resized(source: ImageBitmap, maxSide: number): Promise<ImageBitmap> {
	const { height, width } = fitWithin(source.width, source.height, maxSide);
	return createImageBitmap(source, {
		resizeHeight: height,
		resizeQuality: "high",
		resizeWidth: width,
	}).catch(() => {
		throw new PhotoCaptureError("decode");
	});
}

function canvasBlob(
	canvas: HTMLCanvasElement,
	type: MediaType,
	quality: number
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob(resolve, type, quality);
	});
}

async function encode(
	bitmap: ImageBitmap,
	quality: number
): Promise<{ blob: Blob; type: MediaType }> {
	const canvas = document.createElement("canvas");
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new PhotoCaptureError("encode");
	}
	context.fillStyle = "white";
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.drawImage(bitmap, 0, 0);
	const webp = await canvasBlob(canvas, "image/webp", quality);
	if (webp?.type === "image/webp") {
		return { blob: webp, type: "image/webp" };
	}
	const jpeg = await canvasBlob(canvas, "image/jpeg", quality);
	if (jpeg?.type === "image/jpeg") {
		return { blob: jpeg, type: "image/jpeg" };
	}
	throw new PhotoCaptureError("encode");
}

async function sha256Hex(blob: Blob): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		await blob.arrayBuffer()
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

async function prepared(
	bitmap: ImageBitmap,
	quality: number
): Promise<PreparedFile> {
	const { blob, type } = await encode(bitmap, quality);
	if (blob.size > mediaLimits.maxBytes) {
		throw new PhotoCaptureError("tooLarge");
	}
	return { blob, hash: await sha256Hex(blob), type };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
	const original = await decode(file);
	const photoBitmap = await resized(original, mediaLimits.photoMaxSide).finally(
		() => original.close()
	);
	try {
		const thumbnailBitmap = await resized(
			photoBitmap,
			mediaLimits.thumbnailMaxSide
		);
		try {
			return {
				photo: await prepared(photoBitmap, mediaLimits.photoQuality),
				thumbnail: await prepared(
					thumbnailBitmap,
					mediaLimits.thumbnailQuality
				),
			};
		} finally {
			thumbnailBitmap.close();
		}
	} finally {
		photoBitmap.close();
	}
}

export async function uploadMedia(file: PreparedFile): Promise<void> {
	const response = await fetch(`/api/media/${file.hash}`, {
		body: file.blob,
		credentials: "same-origin",
		headers: { "content-type": file.type },
		method: "PUT",
	}).catch(() => null);
	if (!response) {
		throw new PhotoCaptureError("upload");
	}
	if (response.status !== 200 && response.status !== 201) {
		throw new PhotoCaptureError("upload", response.status);
	}
}
