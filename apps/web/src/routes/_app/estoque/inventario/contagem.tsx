import { createFileRoute } from "@tanstack/react-router";

import { CountPage } from "@/inventory/count-page";

export const Route = createFileRoute("/_app/estoque/inventario/contagem")({
	component: CountPage,
});
