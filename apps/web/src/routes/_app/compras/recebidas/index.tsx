import { createFileRoute } from "@tanstack/react-router";

import { PurchaseListPage } from "@/purchases/purchase-list-page";
import { purchaseListSearch } from "@/purchases/purchase-search";

export const Route = createFileRoute("/_app/compras/recebidas/")({
	component: PurchaseListPage,
	validateSearch: purchaseListSearch,
});
