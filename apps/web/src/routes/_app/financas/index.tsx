import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/financas/")({
	beforeLoad: () => {
		throw redirect({ replace: true, to: "/financas/contas" });
	},
});
