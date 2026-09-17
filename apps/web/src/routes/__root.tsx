import { Toaster } from "@costura-pro/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import Header from "@/components/header";
import NotFound from "@/components/not-found";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

const Devtools = import.meta.env.DEV
	? lazy(() => import("@/components/devtools"))
	: () => null;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	notFoundComponent: NotFound,
	head: () => ({
		links: [{ href: "/favicon.ico", rel: "icon" }],
		meta: [
			{ title: "Costura Pro" },
			{
				content: "Atendimento, produção, estoque e finanças do ateliê",
				name: "description",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<div className="grid min-h-svh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]">
				<Header />
				<Outlet />
			</div>
			<Toaster />
			<Suspense>
				<Devtools />
			</Suspense>
		</>
	);
}
