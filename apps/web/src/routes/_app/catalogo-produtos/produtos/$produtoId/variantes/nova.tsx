import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { NewProductVariantPage } from "@/products/new-product-variant-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/produtos/$produtoId/variantes/nova"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.produtoId)) {
			throw notFound();
		}
	},
	component: NewProductVariantRoute,
});

function NewProductVariantRoute() {
	const { produtoId } = Route.useParams();
	return <NewProductVariantPage key={produtoId} productId={produtoId} />;
}
