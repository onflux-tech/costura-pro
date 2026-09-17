import { commandMessages } from "@costura-pro/api/command-messages";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { clientMeasurementsQuery } from "@/lib/measurement-queries";
import {
	changedMeasurement,
	correctionFields,
	localDay,
	type MeasurementValues,
	type MeasurementView,
	previousMeasurement,
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

export function EditMeasurementPage({
	clientId,
	measurementId,
}: {
	clientId: string;
	measurementId: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [today] = useState(() => localDay(new Date()));
	const [opened, setOpened] = useState<MeasurementView | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const detail = useQuery(clientDetailQuery(clientId));
	const measurements = useQuery(clientMeasurementsQuery(clientId));
	const live = measurements.data?.items.find(
		(item) => item.id === measurementId
	);
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const measurement = opened ?? live;
	usePageHeader({
		backHref: measurement
			? `/atendimento/clientes/${clientId}?perfil=${measurement.profileId}`
			: `/atendimento/clientes/${clientId}`,
		eyebrow: "Atendimento",
		heading: "Corrigir medição",
	});

	if (!measurement && (measurements.isPending || detail.isPending)) {
		return <Skeleton className="h-96" />;
	}
	let blocked: string | null = null;
	if (!measurement) {
		blocked = measurements.error
			? clientCommandFailure(measurements.error, "medição").message
			: commandMessages.measurementNotFound;
	} else if (detail.data?.client.anonymizedAt) {
		blocked = "Este cliente foi anonimizado.";
	}
	if (blocked || !measurement) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para corrigir esta medição</AlertTitle>
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

	const openFicha = () =>
		navigate({
			params: { clienteId: clientId },
			search: { perfil: measurement.profileId },
			to: "/atendimento/clientes/$clienteId",
		});
	const submit = async (values: MeasurementValues) => {
		setFailure(null);
		const patch = changedMeasurement(measurement, values);
		if (Object.keys(patch).length === 0) {
			await openFicha();
			return;
		}
		try {
			await api.measurements.update({
				baseVersion: measurement.version,
				measurementId,
				opId: opIdFor(`${measurement.version}:${JSON.stringify(patch)}`),
				patch,
			});
		} catch (error) {
			setFailure(await failedClientCommand(queryClient, error, "medição"));
			return;
		}
		reset();
		await refreshClients(queryClient);
		await openFicha();
	};

	return (
		<>
			<Heading className="max-md:sr-only">Corrigir medição</Heading>
			<MeasurementForm
				failure={failure}
				heading={`${measurement.templateName} · v${measurement.templateVersion}`}
				initialFields={correctionFields(
					measurement,
					previousMeasurement(measurements.data?.items ?? [], measurement)
				)}
				initialNotes={measurement.notes ?? ""}
				initialTakenOn={measurement.takenOn}
				key={measurement.version}
				onReloadCurrent={async () => {
					setFailure(null);
					const current = await measurements.refetch();
					const fresh = current.data?.items.find(
						(item) => item.id === measurementId
					);
					if (fresh) {
						setOpened(fresh);
					}
				}}
				onSubmit={submit}
				submitLabel="Salvar correção"
				today={today}
			/>
		</>
	);
}
