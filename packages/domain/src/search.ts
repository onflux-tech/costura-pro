const combiningMarks = /\p{M}/gu;
const whitespace = /\s+/g;
const nonDigit = /\D/g;
const phoneLike = /^[\d()+.-]+$/;

export const searchLimits = {
	dialogPerGroup: 3,
	pageSize: 50,
	perGroup: 5,
	query: { max: 100, min: 2 },
	variantsShown: 3,
} as const;

export function normalizeText(value: string): string {
	return value
		.normalize("NFD")
		.replace(combiningMarks, "")
		.toLowerCase()
		.replace(whitespace, " ")
		.trim();
}

export function searchTokens(query: string): string[] {
	return normalizeText(query)
		.split(" ")
		.map((token) =>
			phoneLike.test(token) ? token.replace(nonDigit, "") : token
		)
		.filter((token) => token.length > 0);
}

export function matchesAll(text: string, tokens: readonly string[]): boolean {
	const haystack = normalizeText(text);
	return tokens.every((token) => haystack.includes(token));
}

function normalizedWithOrigin(text: string) {
	const starts: number[] = [];
	const ends: number[] = [];
	let normalized = "";
	let index = 0;
	for (const character of text) {
		const folded = character
			.normalize("NFD")
			.replace(combiningMarks, "")
			.toLowerCase();
		for (const unit of folded) {
			normalized += unit;
			starts.push(index);
			ends.push(index + character.length);
		}
		index += character.length;
	}
	return { ends, normalized, starts };
}

function occurrences(haystack: string, token: string): number[] {
	const found: number[] = [];
	let at = haystack.indexOf(token);
	while (at !== -1) {
		found.push(at);
		at = haystack.indexOf(token, at + 1);
	}
	return found;
}

export function highlightRanges(
	text: string,
	tokens: readonly string[]
): [number, number][] {
	const { ends, normalized, starts } = normalizedWithOrigin(text);
	const ranges = tokens
		.filter((token) => token.length > 0)
		.flatMap((token) =>
			occurrences(normalized, token).map((at): [number, number] => [
				starts[at] ?? 0,
				ends[at + token.length - 1] ?? 0,
			])
		)
		.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
	const merged: [number, number][] = [];
	for (const [start, end] of ranges) {
		const last = merged.at(-1);
		if (last && start <= last[1]) {
			last[1] = Math.max(last[1], end);
		} else {
			merged.push([start, end]);
		}
	}
	return merged;
}

export function matchedVariants<V extends { searchText: string }>(
	parentText: string,
	variants: readonly V[],
	tokens: readonly string[]
): V[] {
	const parent = normalizeText(parentText);
	const pending = tokens.filter((token) => !parent.includes(token));
	if (pending.length === 0) {
		return [];
	}
	return variants
		.map((variant, index) => {
			const text = normalizeText(variant.searchText);
			return {
				index,
				score: pending.filter((token) => text.includes(token)).length,
				variant,
			};
		})
		.filter((entry) => entry.score > 0)
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map((entry) => entry.variant);
}
