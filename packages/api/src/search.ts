const likeSpecial = /[\\%_]/g;

export function containing(token: string): string {
	return `%${token.replace(likeSpecial, (character) => `\\${character}`)}%`;
}
