import { encodeAccessCode } from "@costura-pro/domain/access-code";

import { randomBuffer, sha256Hex } from "../hashing";

export const recoveryCodeCount = 10;
export const recoveryCodeLength = 16;

export type GeneratedCodes = { codes: string[]; hashes: string[] };

export function hashAccessCode(normalized: string): string {
	return sha256Hex(normalized);
}

export function generateRecoveryCodes(): GeneratedCodes {
	const codes = Array.from({ length: recoveryCodeCount }, () =>
		encodeAccessCode(randomBuffer(recoveryCodeLength), recoveryCodeLength)
	);
	return {
		codes,
		hashes: codes.map((code) => hashAccessCode(code.replaceAll("-", ""))),
	};
}
