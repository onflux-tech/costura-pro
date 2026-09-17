import {
	type InstallationState,
	isBeforeOwner,
} from "@costura-pro/domain/installation-state";

export type Access = "local" | "remote";

export type Gate = {
	access: Access;
	signedIn: boolean;
	state: InstallationState;
};

export type WizardStep = "atelier" | "account" | "recovery" | "backup" | "done";

export const wizardRoute = "/configuracao-inicial";

const stepByState = {
	account: "recovery",
	atelier: "account",
	backup: "done",
	empty: "atelier",
	recovery: "backup",
} as const satisfies Record<Exclude<InstallationState, "ready">, WizardStep>;

const redirectBase = "http://costura-pro.invalid";

const unsafeRedirectCharacters = /[\s\\]/;

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
	if (!(signedIn || isBeforeOwner(state))) {
		return { to: "/login" } as const;
	}
	return { screen: "step", step: stepByState[state] } as const;
}

export function loginGate({ signedIn, state }: Gate) {
	if (isBeforeOwner(state)) {
		return { to: wizardRoute } as const;
	}
	return signedIn ? ({ to: "redirect" } as const) : null;
}

export function canReadDetails({ access, signedIn, state }: Gate) {
	return access === "local" && (signedIn || isBeforeOwner(state));
}

export function safeRedirect(value: unknown): string {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		unsafeRedirectCharacters.test(value)
	) {
		return "/";
	}
	const url = new URL(value, redirectBase);
	return url.origin === redirectBase
		? `${url.pathname}${url.search}${url.hash}`
		: "/";
}

type LoginWithReturn = { search: { redirect: string }; to: "/login" };

export function appRedirect(
	gate: Gate,
	href: string
): LoginWithReturn | { to: typeof wizardRoute } | null {
	const decision = appGate(gate);
	if (decision?.to === "/login") {
		return { search: { redirect: href }, to: "/login" };
	}
	return decision;
}

export function loginRedirect(
	gate: Gate,
	search: { redirect?: string }
): { href: string } | { to: typeof wizardRoute } | null {
	const decision = loginGate(gate);
	if (decision?.to === "redirect") {
		return { href: safeRedirect(search.redirect) };
	}
	return decision;
}

export function wizardRedirect(
	gate: Gate
): LoginWithReturn | { to: "/" } | null {
	const decision = wizardGate(gate);
	if (decision.to === "/login") {
		return { search: { redirect: wizardRoute }, to: "/login" };
	}
	return decision.to === "/" ? { to: "/" } : null;
}
