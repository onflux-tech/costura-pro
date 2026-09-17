import { createFileRoute, redirect } from "@tanstack/react-router";

import { appRedirect } from "@/lib/installation-gates";
import { readGate } from "@/lib/installation-queries";
import { AppShell } from "@/shell/app-shell";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ context, location }) => {
		const target = appRedirect(
			await readGate(context.queryClient),
			location.href
		);
		if (target?.to === "/login") {
			throw redirect({ search: target.search, to: "/login" });
		}
		if (target) {
			throw redirect({ to: target.to });
		}
	},
	component: AppShell,
});
