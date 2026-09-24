import { createFileRoute } from "@tanstack/react-router";

import { ReviewPage } from "@/inventory/review-page";

export const Route = createFileRoute("/_app/estoque/inventario/revisao")({
	component: ReviewPage,
});
