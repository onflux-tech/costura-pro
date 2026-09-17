import { createFileRoute } from "@tanstack/react-router";

import { ClientListPage } from "@/atendimento/client-list-page";
import { clientListSearch } from "@/atendimento/client-list-search";

export const Route = createFileRoute("/_app/atendimento/clientes/")({
	component: ClientListPage,
	validateSearch: clientListSearch,
});
