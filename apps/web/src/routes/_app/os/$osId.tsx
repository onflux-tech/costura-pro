import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { ServiceOrderPage } from "@/service-orders/service-order-page";

export const Route = createFileRoute("/_app/os/$osId")({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.osId)) {
			throw notFound();
		}
	},
	component: ServiceOrderRoute,
});

function ServiceOrderRoute() {
	const { osId } = Route.useParams();
	return <ServiceOrderPage key={osId} serviceOrderId={osId} />;
}
