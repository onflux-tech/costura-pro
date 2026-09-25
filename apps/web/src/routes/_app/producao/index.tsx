import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/producao/")({
	beforeLoad: () => {
		throw redirect({ replace: true, to: "/producao/quadro" });
	},
});
