import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { EditProductPage } from "@/products/edit-product-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/produtos/$produtoId/editar"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.produtoId)) {
			throw notFound();
		}
	},
	component: EditProductRoute,
});

function EditProductRoute() {
	const { produtoId } = Route.useParams();
	return <EditProductPage key={produtoId} productId={produtoId} />;
}
