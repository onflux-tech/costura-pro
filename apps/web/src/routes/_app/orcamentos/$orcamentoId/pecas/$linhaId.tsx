import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { PiecePage } from "@/quotes/piece-page";

export const Route = createFileRoute(
	"/_app/orcamentos/$orcamentoId/pecas/$linhaId"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.orcamentoId) && isUuid(params.linhaId))) {
			throw notFound();
		}
	},
	component: PieceRoute,
});

function PieceRoute() {
	const { linhaId, orcamentoId } = Route.useParams();
	return (
		<PiecePage
			key={`${orcamentoId}:${linhaId}`}
			lineId={linhaId}
			quoteId={orcamentoId}
		/>
	);
}
