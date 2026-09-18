import { createFileRoute } from "@tanstack/react-router";

import { NewPurchasePage } from "@/purchases/new-purchase-page";

export const Route = createFileRoute("/_app/compras/recebidas/nova")({
	component: NewPurchasePage,
});
