import { commandMessages } from "@costura-pro/api/command-messages";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	DataList,
	DataListCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { clientMeasurementsQuery } from "@/lib/measurement-queries";
import {
	formatDay,
	historyOf,
	type MeasurementView,
	measuredTemplates,
} from "@/lib/measurements";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { clientDetailQuery } from "./client-queries";
import { MeasurementValues } from "./measurement-values";
import { useClientAction } from "./use-client-action";

export function MeasurementHistoryPage({
	clientId,
	modelo,
	profileId,
}: {
	clientId: string;
	modelo: string | undefined;
	profileId: string;
}) {
	const action = useClientAction();
	const [chosen, setChosen] = useState<string | null>(null);
	const [showArchived, setShowArchived] = useState(false);
	const detail = useQuery(clientDetailQuery(clientId));
	const measurements = useQuery(clientMeasurementsQuery(clientId));
	usePageHeader({
		backHref: `/atendimento/clientes/${clientId}?perfil=${profileId}`,
		eyebrow: "Atendimento",
		heading: "Histórico de medidas",
	});

	if (detail.isPending || measurements.isPending) {
		return <Skeleton className="h-96" />;
	}
	const loadError = detail.error ?? measurements.error;
	const profile = detail.data?.profiles.find((item) => item.id === profileId);
	if (loadError || !(profile && detail.data && measurements.data)) {
		const message = loadError
			? clientCommandFailure(loadError, "cliente").message
			: commandMessages.profileNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir o histórico</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={
							<Link
								params={{ clienteId: clientId }}
								to="/atendimento/clientes/$clienteId"
							/>
						}
						variant="outline"
					>
						Voltar para a ficha
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const readOnly = detail.data.client.anonymizedAt !== null;
	const templates = measuredTemplates(measurements.data.items, profileId);
	const requested = templates.some((item) => item.id === modelo)
		? modelo
		: undefined;
	const templateId = chosen ?? requested ?? templates[0]?.id;
	const pairs = templateId
		? historyOf(measurements.data.items, profileId, templateId)
		: [];
	const archivedCount = pairs.filter(
		(pair) => pair.current.archivedAt !== null
	).length;
	const visible = showArchived
		? pairs
		: pairs.filter((pair) => pair.current.archivedAt === null);
	const toggle = (item: MeasurementView) => {
		const command = item.archivedAt
			? api.measurements.unarchive
			: api.measurements.archive;
		return action.run(
			item.id,
			() =>
				command({
					baseVersion: item.version,
					measurementId: item.id,
					opId: crypto.randomUUID(),
				}),
			"medição"
		);
	};
	const toggleLabel = showArchived
		? "Ocultar arquivadas"
		: `Mostrar arquivadas (${archivedCount})`;

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">{`Histórico · ${profile.name}`}</Heading>
			{templates.length > 1 && templateId ? (
				<ChoiceChips
					aria-label="Modelo de medidas"
					onValueChange={(value) => setChosen(String(value))}
					value={templateId}
				>
					{templates.map((item) => (
						<ChoiceChip key={item.id} value={item.id}>
							{item.name}
						</ChoiceChip>
					))}
				</ChoiceChips>
			) : null}
			<Panel>
				{visible.length === 0 ? (
					<PanelContent>
						<Text tone="subtle">Nenhuma medição ainda.</Text>
					</PanelContent>
				) : (
					<DataList aria-label="Medições" columns="minmax(0,1fr) auto">
						{visible.map(({ current, previous }) => (
							<DataListRow key={current.id}>
								<DataListCell label="Medição">
									<div className="flex flex-col gap-2">
										<div className="flex flex-wrap items-center gap-2">
											<Text weight="semibold">
												{formatDay(current.takenOn)}
											</Text>
											<Text inline size="xs" tone="muted">
												{`${current.templateName} v${current.templateVersion}`}
											</Text>
											{current.archivedAt ? (
												<Badge tone="warning">arquivada</Badge>
											) : null}
										</div>
										<MeasurementValues current={current} previous={previous} />
										{current.notes ? (
											<Text tone="subtle">{current.notes}</Text>
										) : null}
									</div>
								</DataListCell>
								{readOnly ? null : (
									<DataListCell align="end" label="Ações">
										<ButtonLink
											render={
												<Link
													params={{
														clienteId: clientId,
														medicaoId: current.id,
													}}
													to="/atendimento/clientes/$clienteId/medicoes/$medicaoId/editar"
												/>
											}
											size="sm"
											variant="ghost"
										>
											Corrigir
										</ButtonLink>
										<Button
											disabled={action.pending === current.id}
											onClick={() => toggle(current)}
											size="sm"
											variant="ghost"
										>
											{current.archivedAt ? "Desarquivar" : "Arquivar"}
										</Button>
									</DataListCell>
								)}
							</DataListRow>
						))}
					</DataList>
				)}
			</Panel>
			{archivedCount > 0 ? (
				<Button
					className="self-start"
					onClick={() => setShowArchived((current) => !current)}
					variant="link"
				>
					{toggleLabel}
				</Button>
			) : null}
		</div>
	);
}
