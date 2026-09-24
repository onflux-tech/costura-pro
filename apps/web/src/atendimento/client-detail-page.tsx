import { formatPhone } from "@costura-pro/domain/client";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@costura-pro/ui/components/dropdown-menu";
import { Monogram } from "@costura-pro/ui/components/monogram";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import { useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { nameInitials } from "@/lib/initials";
import { statusQuery } from "@/lib/installation-queries";
import { clientMeasurementsQuery } from "@/lib/measurement-queries";
import { profileSummaries, selectedProfileId } from "@/lib/measurements";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { AnonymizeDialog } from "./anonymize-dialog";
import { clientDetailQuery } from "./client-queries";
import { MeasurementPanel } from "./measurement-panel";
import { ProfilePanel } from "./profile-panel";
import { ReceivedItemPanel } from "./received-item-panel";
import { receivedItemsQuery } from "./received-item-queries";
import { useClientAction } from "./use-client-action";

type ContactFields = {
	address: string | null;
	email: string | null;
	phone: string | null;
	secondaryPhone: string | null;
};

function contactLine(client: ContactFields): string {
	const parts = [
		client.phone ? formatPhone(client.phone) : null,
		client.secondaryPhone ? formatPhone(client.secondaryPhone) : null,
		client.email,
		client.address,
	].filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join(" · ") : "Sem contato cadastrado";
}

export function ClientDetailPage({
	clientId,
	perfil,
}: {
	clientId: string;
	perfil: string | undefined;
}) {
	const detail = useQuery(clientDetailQuery(clientId));
	const measurements = useQuery(clientMeasurementsQuery(clientId));
	const receivedItems = useQuery(receivedItemsQuery(clientId));
	const status = useQuery(statusQuery);
	const action = useClientAction();
	const [anonymizing, setAnonymizing] = useState(false);
	usePageHeader({
		backHref: "/atendimento/clientes",
		eyebrow: "Atendimento",
		heading: detail.data?.client.name ?? "Cliente",
	});

	if (detail.isPending) {
		return <Skeleton className="h-64" />;
	}
	if (detail.isError) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não foi possível abrir o cliente</AlertTitle>
				<AlertDescription>
					{clientCommandFailure(detail.error, "cliente").message}
				</AlertDescription>
			</Alert>
		);
	}

	const { client, profiles } = detail.data;
	const anonymized = client.anonymizedAt !== null;
	const archived = client.archivedAt !== null;
	const measurementItems = measurements.data?.items;
	const selectedId = selectedProfileId(profiles, perfil);
	const selected = profiles.find((profile) => profile.id === selectedId);

	const toggleArchive = () => {
		const command = archived ? api.clients.unarchive : api.clients.archive;
		return action.run(
			"archive",
			() =>
				command({
					baseVersion: client.version,
					clientId,
					opId: crypto.randomUUID(),
				}),
			"cliente"
		);
	};

	return (
		<div className="grid gap-4">
			<Panel>
				<PanelContent className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<Monogram initials={nameInitials(client.name)} />
						<div className="flex min-w-0 flex-col gap-1.5">
							<Heading className="max-md:sr-only">{client.name}</Heading>
							<div className="flex flex-wrap gap-1.5">
								<Badge tone="success">cliente pagador</Badge>
								<Badge>
									{client.kind === "person" ? "pessoa" : "organização"}
								</Badge>
								{archived && !anonymized ? (
									<Badge tone="warning">arquivado</Badge>
								) : null}
								{anonymized ? <Badge tone="danger">anonimizado</Badge> : null}
							</div>
							<Text tone="subtle">{contactLine(client)}</Text>
							{client.notes ? <Text tone="muted">{client.notes}</Text> : null}
						</div>
					</div>
					{anonymized ? null : (
						<div className="flex flex-wrap items-center gap-2">
							<ButtonLink
								render={
									<Link
										search={{ cliente: clientId }}
										to="/orcamentos/rascunhos/novo"
									/>
								}
								variant="outline"
							>
								Novo orçamento
							</ButtonLink>
							<ButtonLink
								render={
									<Link
										params={{ clienteId: clientId }}
										to="/atendimento/clientes/$clienteId/pecas/nova"
									/>
								}
							>
								Receber peça
							</ButtonLink>
							<ButtonLink
								render={
									<Link
										params={{ clienteId: clientId }}
										to="/atendimento/clientes/$clienteId/editar"
									/>
								}
								variant="outline"
							>
								Editar
							</ButtonLink>
							<Button
								disabled={action.pending !== null}
								onClick={toggleArchive}
								variant="outline"
							>
								{archived ? "Desarquivar" : "Arquivar"}
							</Button>
							{status.data?.access === "local" ? (
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												aria-label="Mais ações"
												size="icon"
												variant="ghost"
											/>
										}
									>
										<EllipsisIcon aria-hidden="true" />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-44">
										<DropdownMenuItem
											onClick={() => setAnonymizing(true)}
											variant="destructive"
										>
											Anonimizar
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
						</div>
					)}
				</PanelContent>
			</Panel>
			<div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
				<ReceivedItemPanel
					className="md:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-start-1"
					clientId={clientId}
					items={receivedItems.data?.items}
					loadFailed={receivedItems.isError}
					onRetry={() => receivedItems.refetch()}
				/>
				<ProfilePanel
					clientId={clientId}
					profiles={profiles}
					readOnly={anonymized}
					selectedId={selectedId}
					summaries={profileSummaries(profiles, measurementItems)}
				/>
				{selected ? (
					<MeasurementPanel
						clientId={clientId}
						loadFailed={measurements.isError}
						measurements={measurementItems}
						onRetry={() => measurements.refetch()}
						profile={selected}
						readOnly={anonymized}
					/>
				) : null}
			</div>
			<AnonymizeDialog
				client={client}
				onOpenChange={setAnonymizing}
				open={anonymizing}
			/>
		</div>
	);
}
