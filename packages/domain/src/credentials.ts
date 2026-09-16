export const passwordLength = { max: 128, min: 10 } as const;
export const usernameLength = { max: 30, min: 3 } as const;

const usernameCharacters = /^[a-zA-Z0-9_.]+$/;

export function normalizeUsername(input: string): string {
	return input.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
	return (
		username.length >= usernameLength.min &&
		username.length <= usernameLength.max &&
		usernameCharacters.test(username)
	);
}
