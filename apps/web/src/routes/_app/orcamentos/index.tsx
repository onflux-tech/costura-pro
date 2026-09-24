import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/orcamentos/")({
	beforeLoad: () => {
		throw redirect({ replace: true, to: "/orcamentos/rascunhos" });
	},
});
