import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

import { ClientDetailPage } from "@/atendimento/client-detail-page";

export const Route = createFileRoute("/_app/atendimento/clientes/$clienteId/")({
	beforeLoad: ({ params }) => {
		if (!z.uuid().safeParse(params.clienteId).success) {
			throw notFound();
		}
	},
	component: ClientDetailRoute,
});

function ClientDetailRoute() {
	const { clienteId } = Route.useParams();
	return <ClientDetailPage clientId={clienteId} />;
}
