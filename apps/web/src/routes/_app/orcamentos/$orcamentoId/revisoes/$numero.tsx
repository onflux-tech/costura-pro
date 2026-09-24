import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { RevisionPage } from "@/quotes/revision-page";

const revisionNumber = /^[1-9]\d{0,5}$/;

export const Route = createFileRoute(
	"/_app/orcamentos/$orcamentoId/revisoes/$numero"
)({
	beforeLoad: ({ params }) => {
		if (!(isUuid(params.orcamentoId) && revisionNumber.test(params.numero))) {
			throw notFound();
		}
	},
	component: RevisionRoute,
});

function RevisionRoute() {
	const { numero, orcamentoId } = Route.useParams();
	return (
		<RevisionPage
			key={`${orcamentoId}:${numero}`}
			number={Number(numero)}
			quoteId={orcamentoId}
		/>
	);
}
