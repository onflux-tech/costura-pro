const separators = /[._]+/;

export function initials(username: string): string {
	const parts = username.split(separators).filter(Boolean);
	const letters =
		parts.length > 1
			? parts.slice(0, 2).map((part) => part.charAt(0))
			: [...(parts[0] ?? "").slice(0, 2)];
	return letters.join("").toUpperCase();
}
