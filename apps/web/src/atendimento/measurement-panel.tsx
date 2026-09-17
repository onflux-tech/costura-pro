import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import {
	currentByTemplate,
	formatDay,
	type MeasurementView,
} from "@/lib/measurements";

import { MeasurementValues } from "./measurement-values";

export function MeasurementPanel({
	clientId,
	loadFailed,
	measurements,
	onRetry,
	profile,
	readOnly,
}: {
	clientId: string;
	loadFailed: boolean;
	measurements: readonly MeasurementView[] | undefined;
	onRetry: () => void;
	profile: { id: string; name: string };
	readOnly: boolean;
}) {
	const pairs = measurements ? currentByTemplate(measurements, profile.id) : [];
	const params = { clienteId: clientId, perfilId: profile.id };
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{`Medidas · ${profile.name}`}</PanelTitle>
				{readOnly ? null : (
					<ButtonLink
						render={
							<Link
								params={params}
								to="/atendimento/clientes/$clienteId/perfis/$perfilId/medicoes/nova"
							/>
						}
						size="sm"
					>
						Registrar medidas
					</ButtonLink>
				)}
			</PanelHeader>
			{measurements || loadFailed ? null : (
				<PanelContent>
					<Skeleton className="h-24" />
				</PanelContent>
			)}
			{!measurements && loadFailed ? (
				<PanelContent className="flex flex-col items-start gap-2">
					<Text tone="danger">Não foi possível carregar as medidas.</Text>
					<Button onClick={onRetry} size="sm" variant="outline">
						Tentar de novo
					</Button>
				</PanelContent>
			) : null}
			{measurements && pairs.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">Nenhuma medição ainda.</Text>
				</PanelContent>
			) : null}
			{pairs.map(({ current, previous }) => (
				<PanelContent
					className="flex flex-col gap-3 border-divider border-t first:border-t-0"
					key={current.templateId}
				>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<Heading level={3} size="title">
							{current.templateName}
						</Heading>
						<Text size="xs" tone="muted">
							{`v${current.templateVersion} · ${formatDay(current.takenOn)}`}
						</Text>
					</div>
					<MeasurementValues current={current} previous={previous} />
					{current.notes ? <Text tone="subtle">{current.notes}</Text> : null}
					{readOnly ? null : (
						<div className="flex flex-wrap gap-2">
							<ButtonLink
								render={
									<Link
										params={{ clienteId: clientId, medicaoId: current.id }}
										to="/atendimento/clientes/$clienteId/medicoes/$medicaoId/editar"
									/>
								}
								size="sm"
								variant="outline"
							>
								Corrigir
							</ButtonLink>
							<ButtonLink
								render={
									<Link
										params={params}
										search={{ modelo: current.templateId }}
										to="/atendimento/clientes/$clienteId/perfis/$perfilId/medicoes"
									/>
								}
								size="sm"
								variant="ghost"
							>
								Histórico
							</ButtonLink>
						</div>
					)}
				</PanelContent>
			))}
		</Panel>
	);
}
