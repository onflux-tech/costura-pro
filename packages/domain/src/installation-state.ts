export const installationStates = [
	"empty",
	"atelier",
	"account",
	"recovery",
	"backup",
	"ready",
] as const;

export const atelierNameLength = { max: 80, min: 1 } as const;

export type InstallationState = (typeof installationStates)[number];

export function isAtLeast(
	current: InstallationState,
	target: InstallationState
): boolean {
	return (
		installationStates.indexOf(current) >= installationStates.indexOf(target)
	);
}
