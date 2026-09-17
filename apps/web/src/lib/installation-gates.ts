import type { InstallationState } from "@costura-pro/domain/installation-state";

export type Access = "local" | "remote";

export type Gate = {
	access: Access;
	signedIn: boolean;
	state: InstallationState;
};

export type WizardStep = "atelier" | "account" | "recovery" | "backup" | "done";

export const wizardRoute = "/configuracao-inicial";

const beforeOwner = new Set<InstallationState>(["empty", "atelier"]);

const stepByState = {
	account: "recovery",
	atelier: "account",
	backup: "done",
	empty: "atelier",
	recovery: "backup",
} as const satisfies Record<Exclude<InstallationState, "ready">, WizardStep>;

const internalPath = /^\/(?![/\\])/;

export function appGate({ signedIn, state }: Gate) {
	if (state !== "ready") {
		return { to: wizardRoute } as const;
	}
	return signedIn ? null : ({ to: "/login" } as const);
}

export function wizardGate({ access, signedIn, state }: Gate) {
	if (state === "ready") {
		return { to: "/" } as const;
	}
	if (access === "remote") {
		return { screen: "remote" } as const;
	}
	if (!(signedIn || beforeOwner.has(state))) {
		return { to: "/login" } as const;
	}
	return { screen: "step", step: stepByState[state] } as const;
}

export function loginGate({ signedIn, state }: Gate) {
	if (beforeOwner.has(state)) {
		return { to: wizardRoute } as const;
	}
	return signedIn ? ({ to: "redirect" } as const) : null;
}

export function canReadDetails({ access, signedIn, state }: Gate) {
	return access === "local" && (signedIn || beforeOwner.has(state));
}

export function safeRedirect(value: unknown): string {
	return typeof value === "string" && internalPath.test(value) ? value : "/";
}
