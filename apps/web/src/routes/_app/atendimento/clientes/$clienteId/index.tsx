import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

import { ClientDetailPage } from "@/atendimento/client-detail-page";
import { isUuid, optionalUuidSearch } from "@/lib/route-search";

export const Route = createFileRoute("/_app/atendimento/clientes/$clienteId/")({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.clienteId)) {
			throw notFound();
		}
	},
	component: ClientDetailRoute,
	validateSearch: z.object({ perfil: optionalUuidSearch }),
});

function ClientDetailRoute() {
	const { clienteId } = Route.useParams();
	const { perfil } = Route.useSearch();
	return <ClientDetailPage clientId={clienteId} perfil={perfil} />;
}
