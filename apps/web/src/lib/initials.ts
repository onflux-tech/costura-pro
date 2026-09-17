const separators = /[._]+/;
const spaces = /\s+/;
const particles = new Set(["da", "das", "de", "do", "dos", "e"]);

export function initials(username: string): string {
	const parts = username.split(separators).filter(Boolean);
	const letters =
		parts.length > 1
			? parts.slice(0, 2).map((part) => part.charAt(0))
			: [...(parts[0] ?? "").slice(0, 2)];
	return letters.join("").toUpperCase();
}

export function nameInitials(name: string): string {
	const words = name
		.trim()
		.split(spaces)
		.filter((word) => word.length > 0 && !particles.has(word.toLowerCase()));
	const [first = "", second] = words;
	const letters = second
		? [first.charAt(0), second.charAt(0)]
		: [...first.slice(0, 2)];
	return letters.join("").toUpperCase();
}
