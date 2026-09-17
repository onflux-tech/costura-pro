import { createFileRoute } from "@tanstack/react-router";

import { MaterialListPage } from "@/materials/material-list-page";
import { materialListSearch } from "@/materials/material-list-search";

export const Route = createFileRoute("/_app/catalogo-produtos/materiais/")({
	component: MaterialListPage,
	validateSearch: materialListSearch,
});
