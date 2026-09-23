import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { ProductDetailPage } from "@/products/product-detail-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/produtos/$produtoId/"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.produtoId)) {
			throw notFound();
		}
	},
	component: ProductDetailRoute,
});

function ProductDetailRoute() {
	const { produtoId } = Route.useParams();
	return <ProductDetailPage productId={produtoId} />;
}
