import { createFileRoute, redirect } from "@tanstack/react-router";

import { wizardRedirect } from "@/lib/installation-gates";
import { readGate } from "@/lib/installation-queries";
import { WizardPage } from "@/wizard/wizard-page";

export const Route = createFileRoute("/configuracao-inicial")({
	beforeLoad: async ({ context }) => {
		const target = wizardRedirect(await readGate(context.queryClient));
		if (target?.to === "/login") {
			throw redirect({ search: target.search, to: "/login" });
		}
		if (target) {
			throw redirect({ to: target.to });
		}
	},
	component: WizardPage,
	head: () => ({ meta: [{ title: "Configuração inicial · Costura Pro" }] }),
});
