import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { MaterialDetailPage } from "@/materials/material-detail-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/materiais/$materialId/"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.materialId)) {
			throw notFound();
		}
	},
	component: MaterialDetailRoute,
});

function MaterialDetailRoute() {
	const { materialId } = Route.useParams();
	return <MaterialDetailPage materialId={materialId} />;
}
