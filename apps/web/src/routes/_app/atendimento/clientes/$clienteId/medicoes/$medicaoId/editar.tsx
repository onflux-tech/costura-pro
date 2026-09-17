import { createFileRoute, notFound } from "@tanstack/react-router";

import { EditMeasurementPage } from "@/atendimento/edit-measurement-page";
import { isUuid } from "@/lib/route-search";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/medicoes/$medicaoId/editar"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.clienteId) && isUuid(params.medicaoId))) {
			throw notFound();
		}
	},
	component: EditMeasurementRoute,
});

function EditMeasurementRoute() {
	const { clienteId, medicaoId } = Route.useParams();
	return <EditMeasurementPage clientId={clienteId} measurementId={medicaoId} />;
}
