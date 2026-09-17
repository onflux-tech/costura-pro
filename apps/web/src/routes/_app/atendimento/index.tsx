import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/atendimento/")({
	beforeLoad: () => {
		throw redirect({ replace: true, to: "/atendimento/clientes" });
	},
});
