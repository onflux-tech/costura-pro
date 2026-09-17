import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { destinations } from "@/lib/destinations";

export const Route = createFileRoute("/_app/$destino")({
	beforeLoad: ({ params }) => {
		const destination = destinations.find(
			(item) => item.href === `/${params.destino}`
		);
		if (!destination) {
			throw notFound();
		}
		return { destination };
	},
	component: DestinationPlaceholder,
});

function DestinationPlaceholder() {
	const { destination } = Route.useRouteContext();
	return (
		<>
			<Heading className="max-md:sr-only">{destination.label}</Heading>
			<Panel className="max-w-xl">
				<PanelContent className="flex flex-col items-start gap-3 p-6">
					<Heading level={2} size="section">
						Esta área ainda não está disponível
					</Heading>
					<Text tone="subtle">
						Enquanto isso, Hoje mostra o que já dá para configurar.
					</Text>
					<ButtonLink render={<Link to="/" />} variant="outline">
						Ir para Hoje
					</ButtonLink>
				</PanelContent>
			</Panel>
		</>
	);
}
