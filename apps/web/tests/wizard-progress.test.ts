import { expect, test } from "bun:test";

import {
	completedSteps,
	stepState,
	wizardSteps,
} from "../src/lib/wizard-progress";

test("o wizard tem os cinco passos do desenho, na ordem", () => {
	expect(wizardSteps.map((step) => step.label)).toEqual([
		"Nome do ateliê",
		"Conta do dono e senha",
		"Códigos de recuperação guardados",
		"Pasta de backup testada",
		"Checklist de continuidade",
	]);
});

test("conta os passos concluídos por passo atual", () => {
	expect(completedSteps("atelier")).toBe(0);
	expect(completedSteps("account")).toBe(1);
	expect(completedSteps("recovery")).toBe(2);
	expect(completedSteps("backup")).toBe(3);
	expect(completedSteps("done")).toBe(4);
});

test("marca antes, atual e depois", () => {
	expect([0, 1, 2, 3, 4].map((index) => stepState(index, 2))).toEqual([
		"done",
		"done",
		"current",
		"pending",
		"pending",
	]);
});
