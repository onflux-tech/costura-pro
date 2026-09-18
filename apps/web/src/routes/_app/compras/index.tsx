import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/compras/")({
	beforeLoad: () => {
		throw redirect({ replace: true, to: "/compras/recebidas" });
	},
});
