import { createFileRoute, notFound } from "@tanstack/react-router";

import { ReceiveItemPage } from "@/atendimento/receive-item-page";
import { isUuid } from "@/lib/route-search";

export const Route = createFileRoute(
	"/_app/atendimento/clientes/$clienteId/pecas/nova"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.clienteId)) {
			throw notFound();
		}
	},
	component: ReceiveItemRoute,
});

function ReceiveItemRoute() {
	const { clienteId } = Route.useParams();
	return <ReceiveItemPage clientId={clienteId} />;
}
