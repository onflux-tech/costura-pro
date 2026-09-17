import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { NewVariantPage } from "@/materials/new-variant-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/materiais/$materialId/variantes/nova"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.materialId)) {
			throw notFound();
		}
	},
	component: NewVariantRoute,
});

function NewVariantRoute() {
	const { materialId } = Route.useParams();
	return <NewVariantPage materialId={materialId} />;
}
