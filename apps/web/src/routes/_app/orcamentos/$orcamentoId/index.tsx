import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { QuotePage } from "@/quotes/quote-page";

export const Route = createFileRoute("/_app/orcamentos/$orcamentoId/")({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.orcamentoId)) {
			throw notFound();
		}
	},
	component: QuoteRoute,
});

function QuoteRoute() {
	const { orcamentoId } = Route.useParams();
	return <QuotePage key={orcamentoId} quoteId={orcamentoId} />;
}
