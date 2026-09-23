import { createFileRoute } from "@tanstack/react-router";

import { NewProductPage } from "@/products/new-product-page";

export const Route = createFileRoute("/_app/catalogo-produtos/produtos/novo")({
	component: NewProductPage,
});
