import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { draftSummary, type InventoryDraft } from "@/lib/inventory";
import { formatDay, localDay } from "@/lib/measurements";
import { usePageHeader } from "@/shell/page-header";

import { DiscardDraftDialog } from "./discard-draft-dialog";
import { inventorySessionsQuery } from "./inventory-queries";
import { useInventoryDraft } from "./use-inventory-draft";

function DraftPanel({
	draft,
	onDiscard,
}: {
	draft: InventoryDraft;
	onDiscard: () => void;
}) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Contagem em andamento</PanelTitle>
				<PanelMeta>
					{`Neste aparelho, desde ${formatDay(localDay(new Date(draft.startedAt)))}`}
				</PanelMeta>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<Text>{draftSummary(draft)}</Text>
				<div className="flex flex-wrap gap-2">
					<ButtonLink
						className="max-md:w-full"
						render={<Link to="/estoque/inventario/contagem" />}
					>
						Continuar contagem
					</ButtonLink>
					<Button
						className="max-md:w-full"
						onClick={onDiscard}
						variant="outline"
					>
						Descartar
					</Button>
				</div>
			</PanelContent>
		</Panel>
	);
}

function SessionList() {
	const list = useInfiniteQuery(inventorySessionsQuery());
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	return (
		<>
			<Panel>
				{list.isPending ? (
					<PanelContent className="flex flex-col gap-2">
						<Skeleton className="h-10" />
						<Skeleton className="h-10" />
					</PanelContent>
				) : null}
				{list.isError ? (
					<PanelContent>
						<Text tone="danger">
							{clientCommandFailure(list.error, "contagem").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							Nenhuma contagem finalizada ainda.
						</Heading>
						<Text tone="subtle">
							A contagem física confere o estoque local por local e grava os
							ajustes de uma vez.
						</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList
						aria-label="Contagens finalizadas"
						columns="minmax(0,1fr) 8rem 6rem 7rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Contagem</DataListHeaderCell>
							<DataListHeaderCell>Data</DataListHeaderCell>
							<DataListHeaderCell align="end">Itens</DataListHeaderCell>
							<DataListHeaderCell align="end">Divergências</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Contagem">
									<div className="flex flex-col gap-1">
										<ButtonLink
											className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
											render={
												<Link
													params={{ contagemId: item.id }}
													to="/estoque/inventario/$contagemId"
												/>
											}
											variant="link"
										>
											{item.reason}
										</ButtonLink>
										<Text size="sm" tone="subtle">
											{item.locationNames.join(", ")}
										</Text>
									</div>
								</DataListCell>
								<DataListCell label="Data">
									<Text inline numeric>
										{formatDay(item.occurredOn)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Itens">
									<Text inline numeric>
										{item.lineCount}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Divergências">
									<Text inline numeric>
										{item.divergentCount}
									</Text>
								</DataListCell>
							</DataListRow>
						))}
					</DataList>
				) : null}
			</Panel>
			{list.hasNextPage ? (
				<Button
					disabled={list.isFetchingNextPage}
					onClick={() => list.fetchNextPage()}
					variant="outline"
				>
					Carregar mais
				</Button>
			) : null}
		</>
	);
}

export function InventoryListPage() {
	const { draft, failed, save } = useInventoryDraft();
	const [discarding, setDiscarding] = useState(false);
	usePageHeader({ eyebrow: "Estoque", heading: "Inventário" });

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Inventário</Heading>
				{draft ? null : (
					<ButtonLink
						className="max-md:w-full"
						render={<Link to="/estoque/inventario/nova" />}
					>
						Nova contagem
					</ButtonLink>
				)}
			</div>
			{failed ? (
				<Alert tone="warning">
					<AlertTitle>
						O rascunho não está sendo salvo neste aparelho
					</AlertTitle>
					<AlertDescription>
						O navegador recusou guardar a contagem. Ela fica só enquanto esta
						página estiver aberta.
					</AlertDescription>
				</Alert>
			) : null}
			{draft ? (
				<DraftPanel draft={draft} onDiscard={() => setDiscarding(true)} />
			) : null}
			<SessionList />
			<DiscardDraftDialog
				onDiscard={() => save(null)}
				onOpenChange={setDiscarding}
				open={discarding}
			/>
		</div>
	);
}
