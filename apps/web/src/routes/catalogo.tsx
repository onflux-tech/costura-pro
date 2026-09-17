import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CatalogPage = import.meta.env.DEV
	? lazy(() =>
			import("@/catalog/catalog-page").then((module) => ({
				default: module.CatalogPage,
			}))
		)
	: () => null;

export const Route = createFileRoute("/catalogo")({
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw notFound();
		}
	},
	component: CatalogRoute,
});

function CatalogRoute() {
	return (
		<Suspense>
			<CatalogPage />
		</Suspense>
	);
}
