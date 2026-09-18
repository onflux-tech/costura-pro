import { createFileRoute, notFound } from "@tanstack/react-router";

import { isUuid } from "@/lib/route-search";
import { PurchaseDetailPage } from "@/purchases/purchase-detail-page";

export const Route = createFileRoute("/_app/compras/recebidas/$compraId")({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.compraId)) {
			throw notFound();
		}
	},
	component: PurchaseDetailPage,
});
