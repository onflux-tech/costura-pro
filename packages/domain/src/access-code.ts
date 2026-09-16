export const crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type AccessCodeLength = 8 | 16;

const groupSize = 4;
const separators = /[\s-]/g;
const ambiguous: Record<string, string> = { I: "1", L: "1", O: "0" };

export function encodeAccessCode(
	random: Uint8Array,
	length: AccessCodeLength
): string {
	if (random.length < length) {
		throw new RangeError("Bytes aleatórios insuficientes para o código");
	}
	const characters = Array.from(
		random.subarray(0, length),
		(byte) => crockfordAlphabet[byte % crockfordAlphabet.length]
	);
	const groups: string[] = [];
	for (let start = 0; start < length; start += groupSize) {
		groups.push(characters.slice(start, start + groupSize).join(""));
	}
	return groups.join("-");
}

export function normalizeAccessCode(
	input: string,
	length: AccessCodeLength
): string | null {
	const normalized = Array.from(
		input.replace(separators, "").toUpperCase(),
		(character) => ambiguous[character] ?? character
	).join("");
	if (normalized.length !== length) {
		return null;
	}
	for (const character of normalized) {
		if (!crockfordAlphabet.includes(character)) {
			return null;
		}
	}
	return normalized;
}
