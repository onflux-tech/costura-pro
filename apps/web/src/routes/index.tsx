import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { SyncStatus } from "@costura-pro/ui/components/sync-status";
import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

type ServerStatus = { label: string; tone: "offline" | "ok" | "warning" };

function HomeComponent() {
	const healthCheck = useQuery(orpc.healthCheck.queryOptions());
	let status: ServerStatus = {
		label: "Sem conexão com o servidor",
		tone: "offline",
	};
	if (healthCheck.isLoading) {
		status = { label: "Verificando conexão", tone: "warning" };
	} else if (healthCheck.data) {
		status = { label: "Conectado ao servidor", tone: "ok" };
	}
	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
			<Heading>Costura Pro</Heading>
			<Panel>
				<PanelHeader>
					<PanelTitle>Estado do servidor</PanelTitle>
				</PanelHeader>
				<PanelContent>
					<SyncStatus tone={status.tone}>{status.label}</SyncStatus>
				</PanelContent>
			</Panel>
		</main>
	);
}
