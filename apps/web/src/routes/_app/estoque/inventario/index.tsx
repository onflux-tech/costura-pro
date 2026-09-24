import { createFileRoute } from "@tanstack/react-router";

import { InventoryListPage } from "@/inventory/inventory-list-page";

export const Route = createFileRoute("/_app/estoque/inventario/")({
	component: InventoryListPage,
});
