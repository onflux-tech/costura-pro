import { createFileRoute } from "@tanstack/react-router";

import { QuoteListPage } from "@/quotes/quote-list-page";
import { quoteListSearch } from "@/quotes/quote-list-search";

export const Route = createFileRoute("/_app/orcamentos/recusados")({
	component: RefusedRoute,
	validateSearch: quoteListSearch,
});

function RefusedRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<QuoteListPage
			onSearchChange={(next, replace) => navigate({ replace, search: next })}
			search={search}
			status="refused"
		/>
	);
}
