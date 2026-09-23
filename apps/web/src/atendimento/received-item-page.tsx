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
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { PhotoTile } from "@costura-pro/ui/components/photo-tile";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Stat } from "@costura-pro/ui/components/stat";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { blockingError, formatDay, localDay } from "@/lib/measurements";
import { photoUrl } from "@/lib/media";
import { photoAlt } from "@/lib/photos";
import { conditionLabels } from "@/lib/received-items";
import { PhotoViewer } from "@/photos/photo-viewer";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { clientDetailQuery } from "./client-queries";
import { receivedItemsQuery } from "./received-item-queries";
import { ReturnDialog } from "./return-dialog";
import { useClientAction } from "./use-client-action";

export function ReceivedItemPage({
	clientId,
	itemId,
}: {
	clientId: string;
	itemId: string;
}) {
	const detail = useQuery(clientDetailQuery(clientId));
	const items = useQuery(receivedItemsQuery(clientId));
	const action = useClientAction();
	const [today] = useState(() => localDay(new Date()));
	const [returning, setReturning] = useState(false);
	const [viewing, setViewing] = useState<number | null>(null);
	const originRef = useRef<HTMLElement | null>(null);
	const openRefs = useRef(new Map<number, HTMLButtonElement>());
	const item = items.data?.items.find((entry) => entry.id === itemId);
	usePageHeader({
		backHref: `/atendimento/clientes/${clientId}`,
		eyebrow: "Atendimento",
		heading: item?.description ?? "Peça recebida",
	});

	const loadError = blockingError([detail, items]);
	if (!(item || loadError || items.isFetched)) {
		return <Skeleton className="h-96" />;
	}
	if (!item) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não foi possível abrir a peça</AlertTitle>
				<AlertDescription>
					{loadError
						? clientCommandFailure(loadError, "peça").message
						: commandMessages.receivedItemNotFound}
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

	const readOnly = Boolean(detail.data?.client.anonymizedAt);
	const archived = item.archivedAt !== null;
	const version = { baseVersion: item.version, receivedItemId: item.id };
	const updateReturn = (returnedOn: string | null) =>
		action.run(
			"return",
			() =>
				api.receivedItems.update({
					...version,
					opId: crypto.randomUUID(),
					patch: { returnedOn },
				}),
			"peça"
		);
	const toggleArchive = () =>
		action.run(
			"archive",
			() =>
				(archived ? api.receivedItems.unarchive : api.receivedItems.archive)({
					...version,
					opId: crypto.randomUUID(),
				}),
			"peça"
		);
	const total = item.photos.length;

	return (
		<div className="flex flex-col gap-4 md:max-w-3xl">
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Heading className="max-md:sr-only">{item.description}</Heading>
						<div className="flex flex-wrap gap-1.5">
							<Badge tone={item.condition === "good" ? "success" : "warning"}>
								{conditionLabels[item.condition]}
							</Badge>
							{item.returnedOn ? (
								<Badge>{`devolvida ${formatDay(item.returnedOn)}`}</Badge>
							) : (
								<Badge tone="success">em custódia</Badge>
							)}
							{archived ? <Badge tone="warning">arquivada</Badge> : null}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<Stat label="Quantidade" value={`${item.quantity} un`} />
						<Stat label="Recebida em" value={formatDay(item.receivedOn)} />
						<Stat
							label="Devolução prevista"
							value={
								item.expectedReturnOn
									? formatDay(item.expectedReturnOn)
									: "Sem data"
							}
						/>
						<Stat
							label="Devolvida em"
							value={item.returnedOn ? formatDay(item.returnedOn) : "Ainda não"}
						/>
					</div>
					{item.accessories ? (
						<Text tone="subtle">{`Acessórios: ${item.accessories}`}</Text>
					) : null}
					{item.notes ? <Text tone="subtle">{item.notes}</Text> : null}
					{readOnly ? null : (
						<div className="flex flex-wrap gap-2">
							<ButtonLink
								render={
									<Link
										params={{ clienteId: clientId, pecaId: item.id }}
										to="/atendimento/clientes/$clienteId/pecas/$pecaId/corrigir"
									/>
								}
								variant="outline"
							>
								Corrigir
							</ButtonLink>
							<ButtonLink
								render={
									<Link
										params={{ clienteId: clientId, pecaId: item.id }}
										search={{ fotos: true }}
										to="/atendimento/clientes/$clienteId/pecas/$pecaId/corrigir"
									/>
								}
								variant="outline"
							>
								Adicionar fotos
							</ButtonLink>
							{item.returnedOn ? (
								<Button
									disabled={action.pending !== null}
									onClick={() => updateReturn(null)}
									variant="outline"
								>
									Desfazer devolução
								</Button>
							) : (
								<Button
									disabled={action.pending !== null}
									onClick={() => setReturning(true)}
									variant="outline"
								>
									Registrar devolução
								</Button>
							)}
							<Button
								disabled={action.pending !== null}
								onClick={toggleArchive}
								variant="outline"
							>
								{archived ? "Desarquivar" : "Arquivar"}
							</Button>
						</div>
					)}
				</PanelContent>
			</Panel>
			<Panel>
				<PanelHeader>
					<PanelTitle>Fotos de condição</PanelTitle>
					<PanelMeta>{total}</PanelMeta>
				</PanelHeader>
				<PanelContent className="flex flex-wrap gap-3">
					{total === 0 ? <Text tone="subtle">Nenhuma foto.</Text> : null}
					{item.photos.map((photo, index) => (
						<PhotoTile
							alt={photoAlt(index, total, photo.caption)}
							caption={photo.caption}
							key={photo.photoHash}
							onOpen={() => {
								originRef.current = openRefs.current.get(index) ?? null;
								setViewing(index);
							}}
							openRef={(element) => {
								if (element) {
									openRefs.current.set(index, element);
								} else {
									openRefs.current.delete(index);
								}
							}}
							src={photoUrl(photo.thumbnailHash)}
						/>
					))}
				</PanelContent>
			</Panel>
			<PhotoViewer
				index={viewing}
				onIndexChange={setViewing}
				onOpenChange={(open) => {
					if (!open) {
						setViewing(null);
					}
				}}
				photos={item.photos}
				returnFocus={originRef}
			/>
			<ReturnDialog
				item={item}
				key={item.version}
				onConfirm={async (returnedOn) => {
					await updateReturn(returnedOn);
					setReturning(false);
				}}
				onOpenChange={setReturning}
				open={returning}
				pending={action.pending !== null}
				today={today}
			/>
		</div>
	);
}
