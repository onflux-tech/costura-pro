import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

import { NewMeasurementPage } from "@/atendimento/new-measurement-page";
import { isUuid, optionalUuidSearch } from "@/lib/route-search";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/perfis/$perfilId/medicoes/nova"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.clienteId) && isUuid(params.perfilId))) {
			throw notFound();
		}
	},
	component: NewMeasurementRoute,
	validateSearch: z.object({ modelo: optionalUuidSearch }),
});

function NewMeasurementRoute() {
	const { clienteId, perfilId } = Route.useParams();
	const { modelo } = Route.useSearch();
	return (
		<NewMeasurementPage
			clientId={clienteId}
			modelo={modelo}
			profileId={perfilId}
		/>
	);
}
