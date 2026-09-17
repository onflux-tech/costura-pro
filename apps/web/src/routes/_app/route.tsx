import { createFileRoute, redirect } from "@tanstack/react-router";

import { appGate } from "@/lib/installation-gates";
import { readGate } from "@/lib/installation-queries";
import { AppShell } from "@/shell/app-shell";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ context, location }) => {
		const decision = appGate(await readGate(context.queryClient));
		if (decision?.to === "/login") {
			throw redirect({ search: { redirect: location.href }, to: "/login" });
		}
		if (decision) {
			throw redirect({ to: decision.to });
		}
	},
	component: AppShell,
});
