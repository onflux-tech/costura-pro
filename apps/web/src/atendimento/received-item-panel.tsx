import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { DataList, DataListRow } from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Photo } from "@costura-pro/ui/components/photo";
import { Mono, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";
import { useState } from "react";

import {
	custodyGroups,
	custodyLine,
	itemSummary,
	photoUrl,
	type ReceivedItemView,
} from "@/lib/received-items";

function ItemRow({
	clientId,
	item,
}: {
	clientId: string;
	item: ReceivedItemView;
}) {
	const [cover] = item.photos;
	return (
		<DataListRow>
			<div className="flex min-w-0 items-start gap-3">
				{cover ? (
					<Photo
						alt=""
						className="size-12 shrink-0 rounded-md"
						height={96}
						src={photoUrl(cover.thumbnailHash)}
						width={96}
					/>
				) : (
					<div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
						<PackageIcon aria-hidden="true" className="size-5" />
					</div>
				)}
				<div className="flex min-w-0 flex-col gap-0.5">
					<ButtonLink
						className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
						render={
							<Link
								params={{ clienteId: clientId, pecaId: item.id }}
								to="/atendimento/clientes/$clienteId/pecas/$pecaId"
							/>
						}
						variant="link"
					>
						{item.description}
					</ButtonLink>
					<Mono size="2xs" tone="muted">
						{custodyLine(item)}
					</Mono>
					<Text size="xs" tone="muted">
						{itemSummary(item)}
					</Text>
					{item.archivedAt ? <Badge tone="warning">arquivada</Badge> : null}
				</div>
			</div>
		</DataListRow>
	);
}

export function ReceivedItemPanel({
	className,
	clientId,
	items,
	loadFailed,
	onRetry,
}: {
	className?: string;
	clientId: string;
	items: readonly ReceivedItemView[] | undefined;
	loadFailed: boolean;
	onRetry: () => void;
}) {
	const [showOthers, setShowOthers] = useState(false);
	const { inCustody, others } = custodyGroups(items ?? []);
	const visible = showOthers ? [...inCustody, ...others] : inCustody;
	return (
		<Panel className={className}>
			<PanelHeader>
				<PanelTitle>Peças em custódia</PanelTitle>
				<PanelMeta>{inCustody.length}</PanelMeta>
			</PanelHeader>
			{loadFailed && !items ? (
				<PanelContent className="flex flex-col items-start gap-2">
					<Text tone="subtle">Não foi possível carregar as peças.</Text>
					<Button onClick={onRetry} size="sm" variant="outline">
						Tentar de novo
					</Button>
				</PanelContent>
			) : null}
			{items && visible.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">Nenhuma peça em custódia.</Text>
				</PanelContent>
			) : null}
			{visible.length > 0 ? (
				<DataList aria-label="Peças recebidas" columns="minmax(0,1fr)">
					{visible.map((item) => (
						<ItemRow clientId={clientId} item={item} key={item.id} />
					))}
				</DataList>
			) : null}
			<PanelContent className="flex flex-col gap-2 border-divider border-t">
				{others.length > 0 ? (
					<Button
						onClick={() => setShowOthers((current) => !current)}
						variant="link"
					>
						{showOthers
							? "Ocultar devolvidas e arquivadas"
							: `Ver devolvidas e arquivadas (${others.length})`}
					</Button>
				) : null}
				<Text size="xs" tone="muted">
					Peça recebida não é estoque nem faturamento.
				</Text>
			</PanelContent>
		</Panel>
	);
}
