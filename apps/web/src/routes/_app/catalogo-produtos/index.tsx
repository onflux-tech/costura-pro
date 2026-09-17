import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/catalogo-produtos/")({
	beforeLoad: () => {
		throw redirect({
			replace: true,
			to: "/catalogo-produtos/modelos-de-medidas",
		});
	},
});
