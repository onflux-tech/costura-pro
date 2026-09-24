import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { optionalUuidSearch } from "@/lib/route-search";
import { NewQuotePage } from "@/quotes/new-quote-page";

export const Route = createFileRoute("/_app/orcamentos/rascunhos/novo")({
	component: NewQuoteRoute,
	validateSearch: z.object({ cliente: optionalUuidSearch }),
});

function NewQuoteRoute() {
	const { cliente } = Route.useSearch();
	return <NewQuotePage clientId={cliente} />;
}
