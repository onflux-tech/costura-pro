import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { EditMaterialPage } from "@/materials/edit-material-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/materiais/$materialId/editar"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.materialId)) {
			throw notFound();
		}
	},
	component: EditMaterialRoute,
});

function EditMaterialRoute() {
	const { materialId } = Route.useParams();
	return <EditMaterialPage materialId={materialId} />;
}
