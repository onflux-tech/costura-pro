import { createFileRoute } from "@tanstack/react-router";

import { LocationListPage } from "@/stock/location-list-page";
import { locationListSearch } from "@/stock/stock-search";

export const Route = createFileRoute("/_app/estoque/locais")({
	component: LocationListPage,
	validateSearch: locationListSearch,
});
