import { createHash, createHmac, randomBytes } from "node:crypto";

export function sha256Hex(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

export function hmacSha256Hex(secret: string, text: string): string {
	return createHmac("sha256", secret).update(text).digest("hex");
}

export function randomBuffer(length: number): Uint8Array {
	return new Uint8Array(randomBytes(length));
}
