export const installationStates = [
	"empty",
	"atelier",
	"account",
	"recovery",
	"backup",
	"ready",
] as const;

export type InstallationState = (typeof installationStates)[number];

export function isAtLeast(
	current: InstallationState,
	target: InstallationState
): boolean {
	return (
		installationStates.indexOf(current) >= installationStates.indexOf(target)
	);
}
