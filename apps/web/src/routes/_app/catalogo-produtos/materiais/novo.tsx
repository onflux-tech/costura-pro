import { createFileRoute } from "@tanstack/react-router";

import { NewMaterialPage } from "@/materials/new-material-page";

export const Route = createFileRoute("/_app/catalogo-produtos/materiais/novo")({
	component: NewMaterialPage,
});
