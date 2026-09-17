import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

import { EditClientPage } from "@/atendimento/edit-client-page";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/editar"
)({
	beforeLoad: ({ params }) => {
		if (!z.uuid().safeParse(params.clienteId).success) {
			throw notFound();
		}
	},
	component: EditClientRoute,
});

function EditClientRoute() {
	const { clienteId } = Route.useParams();
	return <EditClientPage clientId={clienteId} />;
}
