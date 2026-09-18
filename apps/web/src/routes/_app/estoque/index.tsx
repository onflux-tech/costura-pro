import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/estoque/")({
	beforeLoad: () => {
		throw redirect({ replace: true, to: "/estoque/saldos" });
	},
});
