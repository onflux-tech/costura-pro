import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

import { MeasurementHistoryPage } from "@/atendimento/measurement-history-page";
import { isUuid, optionalUuidSearch } from "@/lib/route-search";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/perfis/$perfilId/medicoes/"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.clienteId) && isUuid(params.perfilId))) {
			throw notFound();
		}
	},
	component: MeasurementHistoryRoute,
	validateSearch: z.object({ modelo: optionalUuidSearch }),
});

function MeasurementHistoryRoute() {
	const { clienteId, perfilId } = Route.useParams();
	const { modelo } = Route.useSearch();
	return (
		<MeasurementHistoryPage
			clientId={clienteId}
			modelo={modelo}
			profileId={perfilId}
		/>
	);
}
