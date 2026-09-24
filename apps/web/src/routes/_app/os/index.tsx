import { createFileRoute } from "@tanstack/react-router";

import { ServiceOrderListPage } from "@/service-orders/service-order-list-page";
import { serviceOrderListSearch } from "@/service-orders/service-order-list-search";

export const Route = createFileRoute("/_app/os/")({
	component: ServiceOrdersRoute,
	validateSearch: serviceOrderListSearch,
});

function ServiceOrdersRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<ServiceOrderListPage
			onSearchChange={(next) => navigate({ replace: true, search: next })}
			search={search}
		/>
	);
}
