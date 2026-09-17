import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading } from "@costura-pro/ui/components/typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { type client as apiClient, orpc } from "@/utils/orpc";

import { ClientForm, type ClientFormSubmit } from "./client-form";
import { changedClientFields, formValuesOf } from "./client-form-values";
import {
	clientDetailQuery,
	failedClientCommand,
	refreshClients,
} from "./client-queries";

type EditedClient = Awaited<ReturnType<typeof apiClient.clients.get>>["client"];

export function EditClientPage({ clientId }: { clientId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const detail = useQuery(clientDetailQuery(clientId));
	const update = useMutation(orpc.clients.update.mutationOptions());
	const [opened, setOpened] = useState<EditedClient | null>(null);
	usePageHeader({
		backHref: `/atendimento/clientes/${clientId}`,
		eyebrow: "Atendimento",
		heading: "Editar cliente",
	});
	useEffect(() => {
		if (!opened && detail.data) {
			setOpened(detail.data.client);
		}
	}, [opened, detail.data]);

	const client = opened ?? detail.data?.client;
	if (!client && detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!client || client.anonymizedAt) {
		const message = client
			? "Este cliente foi anonimizado."
			: clientCommandFailure(detail.error, "cliente").message;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para editar este cliente</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/atendimento/clientes" />}
						variant="outline"
					>
						Voltar para clientes
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const initialValues = formValuesOf(client);
	const openDetail = () =>
		navigate({
			params: { clienteId: clientId },
			to: "/atendimento/clientes/$clienteId",
		});

	const submit = async ({
		createProfile: _createProfile,
		...values
	}: ClientFormSubmit) => {
		setFailure(null);
		const patch = changedClientFields(initialValues, values);
		if (Object.keys(patch).length === 0) {
			await openDetail();
			return;
		}
		try {
			await update.mutateAsync({
				baseVersion: client.version,
				clientId,
				opId: opIdFor(`${client.version}:${JSON.stringify(patch)}`),
				patch,
			});
		} catch (error) {
			setFailure(await failedClientCommand(queryClient, error, "cliente"));
			return;
		}
		reset();
		await refreshClients(queryClient);
		await openDetail();
	};

	return (
		<>
			<Heading className="max-md:sr-only">Editar {client.name}</Heading>
			<ClientForm
				failure={failure}
				initialValues={initialValues}
				key={client.version}
				onReloadCurrent={async () => {
					setFailure(null);
					const current = await detail.refetch();
					if (current.data) {
						setOpened(current.data.client);
					}
				}}
				onSubmit={submit}
				submitLabel="Salvar alterações"
				withProfileOption={false}
			/>
		</>
	);
}
