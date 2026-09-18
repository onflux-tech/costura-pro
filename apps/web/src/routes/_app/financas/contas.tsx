import { createFileRoute } from "@tanstack/react-router";

import { AccountListPage } from "@/finance/account-list-page";
import { accountListSearch } from "@/finance/finance-search";

export const Route = createFileRoute("/_app/financas/contas")({
	component: AccountListPage,
	validateSearch: accountListSearch,
});
