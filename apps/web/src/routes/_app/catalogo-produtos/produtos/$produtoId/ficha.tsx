import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { SheetPage } from "@/products/sheet-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/produtos/$produtoId/ficha"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.produtoId)) {
			throw notFound();
		}
	},
	component: SheetRoute,
});

function SheetRoute() {
	const { produtoId } = Route.useParams();
	return <SheetPage key={produtoId} productId={produtoId} />;
}
