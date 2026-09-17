import { createFileRoute } from "@tanstack/react-router";

import { BalanceListPage } from "@/stock/balance-list-page";
import { balanceListSearch } from "@/stock/stock-search";

export const Route = createFileRoute("/_app/estoque/saldos")({
	component: BalanceListPage,
	validateSearch: balanceListSearch,
});
