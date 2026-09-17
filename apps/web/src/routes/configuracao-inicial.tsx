import { createFileRoute, redirect } from "@tanstack/react-router";

import { wizardGate, wizardRoute } from "@/lib/installation-gates";
import { readGate } from "@/lib/installation-queries";
import { WizardPage } from "@/wizard/wizard-page";

export const Route = createFileRoute("/configuracao-inicial")({
	beforeLoad: async ({ context }) => {
		const decision = wizardGate(await readGate(context.queryClient));
		if (!("to" in decision)) {
			return;
		}
		throw decision.to === "/login"
			? redirect({ search: { redirect: wizardRoute }, to: "/login" })
			: redirect({ to: "/" });
	},
	component: WizardPage,
	head: () => ({ meta: [{ title: "Configuração inicial · Costura Pro" }] }),
});
