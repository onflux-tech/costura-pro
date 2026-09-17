import { describe, expect, test } from "bun:test";
import {
	type InstallationState,
	installationStates,
} from "@costura-pro/domain/installation-state";

import {
	appGate,
	canReadDetails,
	type Gate,
	loginGate,
	safeRedirect,
	wizardGate,
} from "../src/lib/installation-gates";

const wizardStates = installationStates.filter((state) => state !== "ready");

function gate(
	state: InstallationState,
	signedIn: boolean,
	access: Gate["access"] = "local"
): Gate {
	return { access, signedIn, state };
}

describe("appGate", () => {
	test("todo estado antes de ready leva ao wizard, com ou sem sessão", () => {
		for (const state of wizardStates) {
			for (const signedIn of [false, true]) {
				expect(appGate(gate(state, signedIn))).toEqual({
					to: "/configuracao-inicial",
				});
				expect(appGate(gate(state, signedIn, "remote"))).toEqual({
					to: "/configuracao-inicial",
				});
			}
		}
	});

	test("ready sem sessão vai ao login e com sessão entra", () => {
		expect(appGate(gate("ready", false))).toEqual({ to: "/login" });
		expect(appGate(gate("ready", false, "remote"))).toEqual({ to: "/login" });
		expect(appGate(gate("ready", true))).toBeNull();
		expect(appGate(gate("ready", true, "remote"))).toBeNull();
	});
});

describe("wizardGate", () => {
	test("ready volta ao início", () => {
		expect(wizardGate(gate("ready", true))).toEqual({ to: "/" });
		expect(wizardGate(gate("ready", false, "remote"))).toEqual({ to: "/" });
	});

	test("acesso remoto nunca mostra passo", () => {
		for (const state of wizardStates) {
			for (const signedIn of [false, true]) {
				expect(wizardGate(gate(state, signedIn, "remote"))).toEqual({
					screen: "remote",
				});
			}
		}
	});

	test("cada estado local mostra o passo seguinte", () => {
		expect(wizardGate(gate("empty", false))).toEqual({
			screen: "step",
			step: "atelier",
		});
		expect(wizardGate(gate("atelier", false))).toEqual({
			screen: "step",
			step: "account",
		});
		expect(wizardGate(gate("account", true))).toEqual({
			screen: "step",
			step: "recovery",
		});
		expect(wizardGate(gate("recovery", true))).toEqual({
			screen: "step",
			step: "backup",
		});
		expect(wizardGate(gate("backup", true))).toEqual({
			screen: "step",
			step: "done",
		});
	});

	test("local sem sessão depois do dono criado vai ao login", () => {
		for (const state of ["account", "recovery", "backup"] as const) {
			expect(wizardGate(gate(state, false))).toEqual({ to: "/login" });
		}
	});
});

describe("loginGate", () => {
	test("sem dono ainda, o login leva ao wizard", () => {
		for (const state of ["empty", "atelier"] as const) {
			for (const signedIn of [false, true]) {
				expect(loginGate(gate(state, signedIn))).toEqual({
					to: "/configuracao-inicial",
				});
			}
		}
	});

	test("com dono, a sessão segue ao destino pedido e sem sessão mostra o formulário", () => {
		for (const state of ["account", "recovery", "backup", "ready"] as const) {
			expect(loginGate(gate(state, true))).toEqual({ to: "redirect" });
			expect(loginGate(gate(state, false))).toBeNull();
			expect(loginGate(gate(state, false, "remote"))).toBeNull();
		}
	});
});

describe("canReadDetails", () => {
	test("só no acesso local, sem sessão apenas antes da conta", () => {
		expect(canReadDetails(gate("empty", false))).toBe(true);
		expect(canReadDetails(gate("atelier", false))).toBe(true);
		expect(canReadDetails(gate("account", false))).toBe(false);
		expect(canReadDetails(gate("account", true))).toBe(true);
		expect(canReadDetails(gate("ready", true))).toBe(true);
		expect(canReadDetails(gate("empty", false, "remote"))).toBe(false);
		expect(canReadDetails(gate("ready", true, "remote"))).toBe(false);
	});
});

describe("safeRedirect", () => {
	test("aceita só caminho interno", () => {
		expect(safeRedirect("/agenda?dia=2026-09-16")).toBe(
			"/agenda?dia=2026-09-16"
		);
		expect(safeRedirect("/configuracao-inicial")).toBe("/configuracao-inicial");
		expect(safeRedirect("//evil.example/x")).toBe("/");
		expect(safeRedirect("/\\evil.example")).toBe("/");
		expect(safeRedirect("https://evil.example")).toBe("/");
		expect(safeRedirect("agenda")).toBe("/");
		expect(safeRedirect(undefined)).toBe("/");
		expect(safeRedirect(42)).toBe("/");
	});
});
