import { createFileRoute } from "@tanstack/react-router";

import { ServiceListPage } from "@/services/service-list-page";
import { serviceListSearch } from "@/services/service-list-search";

export const Route = createFileRoute("/_app/catalogo-produtos/servicos/")({
	component: ServiceListPage,
	validateSearch: serviceListSearch,
});
