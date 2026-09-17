import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { clientCommandFailure } from "@/lib/client-command-error";
import type { StockLocationView } from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { LocationDialog } from "./location-dialog";
import {
	failedStockCommand,
	refreshStock,
	stockLocationsQuery,
} from "./stock-queries";

const route = getRouteApi("/_app/estoque/locais");

export function LocationListPage() {
	const { arquivados } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [editing, setEditing] = useState<StockLocationView | null>(null);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	usePageHeader({ eyebrow: "Estoque", heading: "Locais" });

	const list = useQuery(stockLocationsQuery(archived));
	const items = list.data?.items ?? [];

	const toggleArchive = async (location: StockLocationView) => {
		setBusy(location.id);
		try {
			const input = {
				baseVersion: location.version,
				locationId: location.id,
				opId: opIdFor(`${location.id}:${location.version}`),
			};
			if (location.archivedAt) {
				await api.stockLocations.unarchive(input);
			} else {
				await api.stockLocations.archive(input);
			}
			await refreshStock(queryClient);
		} catch (error) {
			const failed = await failedStockCommand(queryClient, error, "local");
			toast.error(failed.message);
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Locais</Heading>
				<Button
					className="max-md:w-full"
					onClick={() => {
						setEditing(null);
						setOpen(true);
					}}
				>
					Novo local
				</Button>
			</div>
			<ChoiceChips
				aria-label="Situação"
				onValueChange={(value) =>
					navigate({
						search: () => ({
							arquivados: value === "arquivados" ? (1 as const) : undefined,
						}),
					})
				}
				value={archived ? "arquivados" : "ativos"}
			>
				<ChoiceChip value="ativos">Ativos</ChoiceChip>
				<ChoiceChip value="arquivados">Arquivados</ChoiceChip>
			</ChoiceChips>
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
							{clientCommandFailure(list.error, "local").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{archived ? "Nenhum local arquivado" : "Nenhum local ainda"}
						</Heading>
						<Text tone="subtle">
							{archived
								? "Local arquivado sai das escolhas e mantém o histórico."
								: "Crie o armário, a prateleira ou a área onde o material fica guardado."}
						</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList aria-label="Locais" columns="minmax(0,1fr) 12rem">
						<DataListHeader>
							<DataListHeaderCell>Local</DataListHeaderCell>
							<DataListHeaderCell align="end">Ações</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Local">
									<div className="flex flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<Text weight="semibold">{item.name}</Text>
											{item.archivedAt ? (
												<Badge tone="warning">arquivado</Badge>
											) : null}
										</div>
										{item.notes ? (
											<Text size="sm" tone="subtle">
												{item.notes}
											</Text>
										) : null}
									</div>
								</DataListCell>
								<DataListCell align="end" label="Ações">
									<div className="flex flex-wrap gap-2 md:justify-end">
										<Button
											onClick={() => {
												setEditing(item);
												setOpen(true);
											}}
											size="sm"
											variant="outline"
										>
											Editar
										</Button>
										<Button
											disabled={busy === item.id}
											onClick={() => toggleArchive(item)}
											size="sm"
											variant="ghost"
										>
											{item.archivedAt ? "Desarquivar" : "Arquivar"}
										</Button>
									</div>
								</DataListCell>
							</DataListRow>
						))}
					</DataList>
				) : null}
			</Panel>
			<LocationDialog location={editing} onOpenChange={setOpen} open={open} />
		</div>
	);
}
