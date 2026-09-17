import type { WizardStep } from "./installation-gates";

export const wizardSteps = [
	{ id: "atelier", label: "Nome do ateliê" },
	{ id: "account", label: "Conta do dono e senha" },
	{ id: "recovery", label: "Códigos de recuperação guardados" },
	{ id: "backup", label: "Pasta de backup testada" },
	{ id: "continuity", label: "Checklist de continuidade" },
] as const;

export function completedSteps(step: WizardStep): number {
	return step === "done"
		? 4
		: wizardSteps.findIndex((item) => item.id === step);
}

export function stepState(index: number, current: number) {
	if (index < current) {
		return "done" as const;
	}
	return index === current ? ("current" as const) : ("pending" as const);
}
