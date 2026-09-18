import { createFileRoute } from "@tanstack/react-router";

import { supplierListSearch } from "@/purchases/purchase-search";
import { SupplierListPage } from "@/purchases/supplier-list-page";

export const Route = createFileRoute("/_app/compras/fornecedores")({
	component: SupplierListPage,
	validateSearch: supplierListSearch,
});
