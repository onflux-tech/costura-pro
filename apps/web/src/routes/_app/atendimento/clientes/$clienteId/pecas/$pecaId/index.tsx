import { createFileRoute, notFound } from "@tanstack/react-router";

import { ReceivedItemPage } from "@/atendimento/received-item-page";
import { isUuid } from "@/lib/route-search";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/pecas/$pecaId/"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.clienteId) && isUuid(params.pecaId))) {
			throw notFound();
		}
	},
	component: ReceivedItemRoute,
});

function ReceivedItemRoute() {
	const { clienteId, pecaId } = Route.useParams();
	return <ReceivedItemPage clientId={clienteId} itemId={pecaId} />;
}
