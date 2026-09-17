export function photoUrl(hash: string, download = false): string {
	return download ? `/api/media/${hash}?download=1` : `/api/media/${hash}`;
}
