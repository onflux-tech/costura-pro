import { createFileRoute } from "@tanstack/react-router";

import { SearchPage } from "@/search/search-page";
import { globalSearchParams } from "@/search/search-params";

export const Route = createFileRoute("/_app/busca")({
	component: SearchPage,
	validateSearch: globalSearchParams,
});
