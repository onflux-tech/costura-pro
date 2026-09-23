import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { EditProductVariantPage } from "@/products/edit-product-variant-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/produtos/$produtoId/variantes/$varianteId"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.produtoId) && isUuid(params.varianteId))) {
			throw notFound();
		}
	},
	component: EditProductVariantRoute,
});

function EditProductVariantRoute() {
	const { produtoId, varianteId } = Route.useParams();
	return (
		<EditProductVariantPage
			key={varianteId}
			productId={produtoId}
			variantId={varianteId}
		/>
	);
}
