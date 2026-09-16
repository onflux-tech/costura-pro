function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => (left < right ? -1 : 1))
				.map(([key, entry]) => [key, sortKeys(entry)])
		);
	}
	return value;
}

export function canonicalJson(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}
