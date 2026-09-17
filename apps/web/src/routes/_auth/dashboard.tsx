import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	const privateData = useQuery(orpc.privateData.queryOptions());

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-8">
			<Heading>Painel</Heading>
			<Text tone="subtle">Olá, {session.data?.user.name}.</Text>
			<Text tone="muted">{privateData.data?.message}</Text>
		</main>
	);
}
