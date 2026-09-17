import { createFileRoute, notFound } from "@tanstack/react-router";
import { isUuid } from "@/lib/route-search";
import { EditTemplatePage } from "@/measurement-templates/edit-template-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/modelos-de-medidas/$modeloId"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.modeloId)) {
			throw notFound();
		}
	},
	component: EditTemplateRoute,
});

function EditTemplateRoute() {
	const { modeloId } = Route.useParams();
	return <EditTemplatePage templateId={modeloId} />;
}
