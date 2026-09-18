import { createFileRoute } from "@tanstack/react-router";

import { obligationListSearch } from "@/finance/finance-search";
import { ObligationListPage } from "@/finance/obligation-list-page";

export const Route = createFileRoute("/_app/financas/a-pagar")({
	component: ObligationListPage,
	validateSearch: obligationListSearch,
});
