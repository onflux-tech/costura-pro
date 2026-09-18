import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { EditServicePage } from "@/services/edit-service-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/servicos/$servicoId"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.servicoId)) {
			throw notFound();
		}
	},
	component: EditServiceRoute,
});

function EditServiceRoute() {
	const { servicoId } = Route.useParams();
	return <EditServicePage key={servicoId} serviceId={servicoId} />;
}
