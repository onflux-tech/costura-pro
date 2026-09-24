import { createFileRoute } from "@tanstack/react-router";

import { NewCountPage } from "@/inventory/new-count-page";

export const Route = createFileRoute("/_app/estoque/inventario/nova")({
	component: NewCountPage,
});
