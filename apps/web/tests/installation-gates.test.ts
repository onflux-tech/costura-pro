import { describe, expect, test } from "bun:test";
import {
	type InstallationState,
	installationStates,
} from "@costura-pro/domain/installation-state";

import {
	appGate,
	appRedirect,
	canReadDetails,
	type Gate,
	loginGate,
	loginRedirect,
	safeRedirect,
	wizardGate,
	wizardRedirect,
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
	test("sem dono ainda, o login leva ao wizard, local ou remoto", () => {
		for (const state of ["empty", "atelier"] as const) {
			for (const signedIn of [false, true]) {
				for (const access of ["local", "remote"] as const) {
					expect(loginGate(gate(state, signedIn, access))).toEqual({
						to: "/configuracao-inicial",
					});
				}
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
		expect(safeRedirect("/os/12#pagamento")).toBe("/os/12#pagamento");
		expect(safeRedirect("//evil.example/x")).toBe("/");
		expect(safeRedirect("/\t/evil.example")).toBe("/");
		expect(safeRedirect("/\n/evil.example")).toBe("/");
		expect(safeRedirect("/ /evil.example")).toBe("/");
		expect(safeRedirect("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
		expect(safeRedirect("/\\evil.example")).toBe("/");
		expect(safeRedirect("https://evil.example")).toBe("/");
		expect(safeRedirect("agenda")).toBe("/");
		expect(safeRedirect(undefined)).toBe("/");
		expect(safeRedirect(42)).toBe("/");
	});
});

describe("redirecionamentos das rotas", () => {
	test("o shell manda ao login guardando o destino pedido", () => {
		expect(appRedirect(gate("ready", false), "/agenda?dia=2")).toEqual({
			search: { redirect: "/agenda?dia=2" },
			to: "/login",
		});
		expect(appRedirect(gate("recovery", true), "/agenda")).toEqual({
			to: "/configuracao-inicial",
		});
		expect(appRedirect(gate("ready", true), "/agenda")).toBeNull();
	});

	test("o login com sessão segue só para caminho interno", () => {
		expect(loginRedirect(gate("ready", true), { redirect: "/agenda" })).toEqual(
			{ href: "/agenda" }
		);
		expect(
			loginRedirect(gate("ready", true), { redirect: "https://evil.example" })
		).toEqual({ href: "/" });
		expect(
			loginRedirect(gate("ready", true), { redirect: "/\t/evil.example" })
		).toEqual({ href: "/" });
		expect(loginRedirect(gate("ready", true), {})).toEqual({ href: "/" });
		expect(loginRedirect(gate("ready", false), { redirect: "/" })).toBeNull();
		expect(loginRedirect(gate("atelier", false), {})).toEqual({
			to: "/configuracao-inicial",
		});
	});

	test("o wizard volta ao início ou vai ao login voltando a ele", () => {
		expect(wizardRedirect(gate("ready", true))).toEqual({ to: "/" });
		expect(wizardRedirect(gate("backup", false))).toEqual({
			search: { redirect: "/configuracao-inicial" },
			to: "/login",
		});
		expect(wizardRedirect(gate("backup", true))).toBeNull();
		expect(wizardRedirect(gate("empty", false, "remote"))).toBeNull();
	});
});
