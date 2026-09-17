import { createFileRoute } from "@tanstack/react-router";

import { NewClientPage } from "@/atendimento/new-client-page";

export const Route = createFileRoute("/_app/atendimento/clientes/novo")({
	component: NewClientPage,
});
