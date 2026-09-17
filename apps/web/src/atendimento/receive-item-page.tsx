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
import { useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { blockingError, localDay } from "@/lib/measurements";
import { emptyFormValues, type ReceivedItemFields } from "@/lib/received-items";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	clientDetailQuery,
	failedClientCommand,
	refreshClients,
} from "./client-queries";
import { ReceivedItemForm } from "./received-item-form";
import { usePhotoDrafts } from "./use-photo-drafts";

export function ReceiveItemPage({ clientId }: { clientId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [receivedItemId, setReceivedItemId] = useState(() =>
		crypto.randomUUID()
	);
	const [today] = useState(() => localDay(new Date()));
	const [initialValues] = useState(() => emptyFormValues(today));
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const photos = usePhotoDrafts([]);
	const detail = useQuery(clientDetailQuery(clientId));
	usePageHeader({
		backHref: `/atendimento/clientes/${clientId}`,
		eyebrow: "Atendimento",
		heading: "Receber peça",
	});

	const loadError = blockingError([detail]);
	if (!(loadError || detail.data)) {
		return <Skeleton className="h-96" />;
	}
	let blocked: string | null = null;
	if (loadError) {
		blocked = clientCommandFailure(loadError, "cliente").message;
	} else if (detail.data?.client.anonymizedAt) {
		blocked = "Este cliente foi anonimizado.";
	}
	if (blocked || !detail.data) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para receber peça</AlertTitle>
				<AlertDescription>
					{blocked ?? commandMessages.clientNotFound}
				</AlertDescription>
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

	const submit = async (fields: ReceivedItemFields) => {
		setFailure(null);
		const payload = { ...fields, clientId };
		try {
			await api.receivedItems.create({
				...payload,
				opId: opIdFor(JSON.stringify(payload)),
				receivedItemId,
			});
		} catch (error) {
			const failed = await failedClientCommand(queryClient, error, "peça");
			if (failed.kind === "exists") {
				toast.info("Esta peça já tinha sido recebida. Confira os dados.");
				await navigate({
					params: { clienteId: clientId, pecaId: receivedItemId },
					to: "/atendimento/clientes/$clienteId/pecas/$pecaId",
				});
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		setReceivedItemId(crypto.randomUUID());
		await refreshClients(queryClient);
		await navigate({
			params: { clienteId: clientId },
			to: "/atendimento/clientes/$clienteId",
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">{`Receber peça · ${detail.data.client.name}`}</Heading>
			<ReceivedItemForm
				failure={failure}
				heading={`Receber peça do cliente · ${detail.data.client.name}`}
				initialValues={initialValues}
				onSubmit={submit}
				photos={photos}
				submitLabel="Receber peça"
				today={today}
			/>
		</div>
	);
}
