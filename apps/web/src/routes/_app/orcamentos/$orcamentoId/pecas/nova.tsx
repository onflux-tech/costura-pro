import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { PiecePage } from "@/quotes/piece-page";

export const Route = createFileRoute(
	"/_app/orcamentos/$orcamentoId/pecas/nova"
)({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.orcamentoId)) {
			throw notFound();
		}
	},
	component: NewPieceRoute,
});

function NewPieceRoute() {
	const { orcamentoId } = Route.useParams();
	return <PiecePage key={orcamentoId} lineId={null} quoteId={orcamentoId} />;
}
