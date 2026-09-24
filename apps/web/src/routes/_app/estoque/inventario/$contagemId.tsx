import { createFileRoute, notFound } from "@tanstack/react-router";

import { SessionPage } from "@/inventory/session-page";
import { isUuid } from "@/lib/route-search";

export const Route = createFileRoute("/_app/estoque/inventario/$contagemId")({
	beforeLoad: ({ params }) => {
		if (!isUuid(params.contagemId)) {
			throw notFound();
		}
	},
	component: SessionPage,
});
