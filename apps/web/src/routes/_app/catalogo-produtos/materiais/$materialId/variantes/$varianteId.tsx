import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { EditVariantPage } from "@/materials/edit-variant-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/materiais/$materialId/variantes/$varianteId"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.materialId) && isUuid(params.varianteId))) {
			throw notFound();
		}
	},
	component: EditVariantRoute,
});

function EditVariantRoute() {
	const { materialId, varianteId } = Route.useParams();
	return <EditVariantPage materialId={materialId} variantId={varianteId} />;
}
