import { createFileRoute } from "@tanstack/react-router";

import { NewServicePage } from "@/services/new-service-page";

export const Route = createFileRoute("/_app/catalogo-produtos/servicos/novo")({
	component: NewServicePage,
});
