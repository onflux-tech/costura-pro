import { commandMessages } from "@costura-pro/api/command-messages";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	clientMeasurementsQuery,
	measurementTemplatesQuery,
} from "@/lib/measurement-queries";
import {
	blockingError,
	currentByTemplate,
	defaultTemplateId,
	draftFields,
	localDay,
	type MeasurementValues,
	type MeasurementView,
	type TemplateView,
} from "@/lib/measurements";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	clientDetailQuery,
	failedClientCommand,
	refreshClients,
} from "./client-queries";
import { MeasurementForm } from "./measurement-form";

type Target = { clientId: string; profileId: string };

type Submission = {
	measurementId: string;
	opIdFor: (key: string) => string;
	saved: () => void;
};

function NewMeasurementForm({
	clientId,
	previous,
	profileId,
	submission,
	template,
	today,
}: Target & {
	previous: MeasurementView | null;
	submission: Submission;
	template: TemplateView;
	today: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [origin] = useState(template);
	const [initialFields] = useState(() => draftFields(template, previous));
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);

	const submit = async (values: MeasurementValues) => {
		setFailure(null);
		const { measurementId } = submission;
		const payload = {
			...values,
			profileId,
			templateId: origin.id,
			templateName: origin.name,
			templateVersion: origin.version,
		};
		try {
			await api.measurements.create({
				...payload,
				measurementId,
				opId: submission.opIdFor(JSON.stringify(payload)),
			});
		} catch (error) {
			const failed = await failedClientCommand(queryClient, error, "medição");
			if (failed.kind === "exists") {
				toast.info("Esta medição já tinha sido salva. Confira os valores.");
				await navigate({
					params: { clienteId: clientId, medicaoId: measurementId },
					to: "/atendimento/clientes/$clienteId/medicoes/$medicaoId/editar",
				});
				return;
			}
			setFailure(failed);
			return;
		}
		submission.saved();
		await refreshClients(queryClient);
		await navigate({
			params: { clienteId: clientId },
			search: { perfil: profileId },
			to: "/atendimento/clientes/$clienteId",
		});
	};

	return (
		<MeasurementForm
			failure={failure}
			heading={`${origin.name} · v${origin.version}`}
			initialFields={initialFields}
			initialNotes=""
			initialTakenOn={today}
			onSubmit={submit}
			submitLabel="Salvar medidas"
			today={today}
		/>
	);
}

export function NewMeasurementPage({
	clientId,
	modelo,
	profileId,
}: Target & { modelo: string | undefined }) {
	const { opIdFor, reset } = useOpId();
	const [measurementId, setMeasurementId] = useState(() => crypto.randomUUID());
	const [chosen, setChosen] = useState<string | null>(null);
	const [today] = useState(() => localDay(new Date()));
	const detail = useQuery(clientDetailQuery(clientId));
	const measurements = useQuery(clientMeasurementsQuery(clientId));
	const templates = useQuery(measurementTemplatesQuery());
	const defaultId =
		measurements.data && templates.data
			? defaultTemplateId(
					templates.data.items,
					measurements.data.items,
					profileId,
					modelo
				)
			: null;
	useEffect(() => {
		if (chosen === null && defaultId !== null) {
			setChosen(defaultId);
		}
	}, [chosen, defaultId]);
	usePageHeader({
		backHref: `/atendimento/clientes/${clientId}?perfil=${profileId}`,
		eyebrow: "Atendimento",
		heading: "Registrar medidas",
	});

	const loadError = blockingError([detail, measurements, templates]);
	if (!(loadError || (detail.data && measurements.data && templates.data))) {
		return <Skeleton className="h-96" />;
	}
	const profile = detail.data?.profiles.find((item) => item.id === profileId);
	let blocked: string | null = null;
	if (loadError) {
		blocked = clientCommandFailure(loadError, "cliente").message;
	} else if (!profile) {
		blocked = commandMessages.profileNotFound;
	} else if (detail.data?.client.anonymizedAt) {
		blocked = "Este cliente foi anonimizado.";
	}
	if (blocked || !(profile && measurements.data && templates.data)) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para registrar medidas</AlertTitle>
				<AlertDescription>{blocked}</AlertDescription>
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

	const templateId = chosen ?? defaultId;
	const template = templates.data.items.find((item) => item.id === templateId);
	if (!template) {
		return (
			<Panel>
				<PanelContent className="flex flex-col items-start gap-3 p-6">
					<Heading level={2} size="section">
						Nenhum modelo de medidas ativo
					</Heading>
					<Text tone="subtle">
						Ative ou crie um modelo em Catálogo para registrar medidas.
					</Text>
					<ButtonLink
						render={<Link to="/catalogo-produtos/modelos-de-medidas" />}
						variant="outline"
					>
						Abrir modelos de medidas
					</ButtonLink>
				</PanelContent>
			</Panel>
		);
	}
	const choices = templates.data.items.filter(
		(item) => item.archivedAt === null || item.id === template.id
	);
	const previous =
		currentByTemplate(measurements.data.items, profileId).find(
			(pair) => pair.current.templateId === template.id
		)?.current ?? null;
	const submission: Submission = {
		measurementId,
		opIdFor,
		saved: () => {
			reset();
			setMeasurementId(crypto.randomUUID());
		},
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">{`Registrar medidas · ${profile.name}`}</Heading>
			<ChoiceChips
				aria-label="Modelo de medidas"
				onValueChange={(value) => setChosen(String(value))}
				value={template.id}
			>
				{choices.map((item) => (
					<ChoiceChip key={item.id} value={item.id}>
						{item.name}
					</ChoiceChip>
				))}
			</ChoiceChips>
			<NewMeasurementForm
				clientId={clientId}
				key={template.id}
				previous={previous}
				profileId={profileId}
				submission={submission}
				template={template}
				today={today}
			/>
		</div>
	);
}
