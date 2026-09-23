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
import { blockingError, localDay } from "@/lib/measurements";
import {
	changedReceivedItem,
	formValuesOf,
	type ReceivedItemFields,
	type ReceivedItemView,
	receivedItemPhotoLimit,
} from "@/lib/received-items";
import { useOpId } from "@/lib/use-op-id";
import { usePhotoDrafts } from "@/photos/use-photo-drafts";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	clientDetailQuery,
	failedClientCommand,
	refreshClients,
} from "./client-queries";
import { ReceivedItemForm } from "./received-item-form";
import { receivedItemsQuery } from "./received-item-queries";

export function EditReceivedItemPage({
	clientId,
	focusPhotos,
	itemId,
}: {
	clientId: string;
	focusPhotos: boolean;
	itemId: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [today] = useState(() => localDay(new Date()));
	const [opened, setOpened] = useState<ReceivedItemView | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const detail = useQuery(clientDetailQuery(clientId));
	const items = useQuery(receivedItemsQuery(clientId));
	const photos = usePhotoDrafts([], receivedItemPhotoLimit);
	const live = items.data?.items.find((entry) => entry.id === itemId);
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
			photos.reset(live.photos);
		}
	}, [opened, live, photos.reset]);
	const item = opened ?? live;
	usePageHeader({
		backHref: `/atendimento/clientes/${clientId}/pecas/${itemId}`,
		eyebrow: "Atendimento",
		heading: "Corrigir peça",
	});

	const loadError = blockingError([detail, items]);
	if (!(item || loadError || items.isFetched)) {
		return <Skeleton className="h-96" />;
	}
	let blocked: string | null = null;
	if (!item) {
		blocked = loadError
			? clientCommandFailure(loadError, "peça").message
			: commandMessages.receivedItemNotFound;
	} else if (detail.data?.client.anonymizedAt) {
		blocked = "Este cliente foi anonimizado.";
	}
	if (blocked || !item) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para corrigir esta peça</AlertTitle>
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

	const openItem = () =>
		navigate({
			params: { clienteId: clientId, pecaId: itemId },
			to: "/atendimento/clientes/$clienteId/pecas/$pecaId",
		});
	const submit = async (fields: ReceivedItemFields) => {
		setFailure(null);
		const patch = changedReceivedItem(item, fields);
		if (!patch) {
			await openItem();
			return;
		}
		try {
			await api.receivedItems.update({
				baseVersion: item.version,
				opId: opIdFor(`${item.version}:${JSON.stringify(patch)}`),
				patch,
				receivedItemId: itemId,
			});
		} catch (error) {
			setFailure(await failedClientCommand(queryClient, error, "peça"));
			return;
		}
		reset();
		await refreshClients(queryClient);
		await openItem();
	};

	return (
		<>
			<Heading className="max-md:sr-only">Corrigir peça</Heading>
			<ReceivedItemForm
				failure={failure}
				focusPhotos={focusPhotos}
				heading={item.description}
				initialValues={formValuesOf(item)}
				key={item.version}
				onReloadCurrent={async () => {
					setFailure(null);
					const current = await items.refetch();
					const fresh = current.data?.items.find(
						(entry) => entry.id === itemId
					);
					if (fresh) {
						setOpened(fresh);
						photos.reset(fresh.photos);
					}
				}}
				onSubmit={submit}
				photos={photos}
				returnedOn={item.returnedOn}
				submitLabel="Salvar correção"
				today={today}
			/>
		</>
	);
}
