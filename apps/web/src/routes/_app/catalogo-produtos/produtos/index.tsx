import { createFileRoute } from "@tanstack/react-router";

import { ProductListPage } from "@/products/product-list-page";
import { productListSearch } from "@/products/product-list-search";

export const Route = createFileRoute("/_app/catalogo-produtos/produtos/")({
	component: ProductListPage,
	validateSearch: productListSearch,
});
