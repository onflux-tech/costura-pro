import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";

import { EditReceivedItemPage } from "@/atendimento/edit-received-item-page";
import { isUuid } from "@/lib/route-search";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/pecas/$pecaId/corrigir"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.clienteId) && isUuid(params.pecaId))) {
			throw notFound();
		}
	},
	component: EditReceivedItemRoute,
	validateSearch: z.object({ fotos: z.boolean().optional().catch(undefined) }),
});

function EditReceivedItemRoute() {
	const { clienteId, pecaId } = Route.useParams();
	const { fotos } = Route.useSearch();
	return (
		<EditReceivedItemPage
			clientId={clienteId}
			focusPhotos={fotos === true}
			itemId={pecaId}
		/>
	);
}
