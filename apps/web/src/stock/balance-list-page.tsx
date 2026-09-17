import { Badge } from "@costura-pro/ui/components/badge";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@costura-pro/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import {
	type BalanceItemView,
	balanceQuantity,
	balanceValue,
} from "@/lib/stock";
import { usePageHeader } from "@/shell/page-header";
import { orpc } from "@/utils/orpc";

import { type MovementAction, MovementDialog } from "./movement-dialog";
import { stockLocationsQuery } from "./stock-queries";
import { VariantBalancePanel } from "./variant-balance-panel";

const route = getRouteApi("/_app/estoque/saldos");

const allLocations = "*";

export function BalanceListPage() {
	const { busca = "", local } = route.useSearch();
	const navigate = route.useNavigate();
	const [query, setQuery] = useState(busca);
	const [opened, setOpened] = useState<string | null>(null);
	const [action, setAction] = useState<MovementAction>("opening");
	const [target, setTarget] = useState<BalanceItemView | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const locations = useQuery(stockLocationsQuery());
	usePageHeader({ eyebrow: "Estoque", heading: "Saldos" });

	useEffect(() => {
		const next = query.trim();
		if (next === busca) {
			return;
		}
		const timer = setTimeout(() => {
			navigate({
				replace: true,
				search: (previous) => ({ ...previous, busca: next || undefined }),
			});
		}, 300);
		return () => clearTimeout(timer);
	}, [busca, navigate, query]);

	const list = useInfiniteQuery(
		orpc.stockBalances.list.infiniteOptions({
			getNextPageParam: (page) => page.nextOffset ?? undefined,
			initialPageParam: 0,
			input: (offset: number) => ({
				locationId: local,
				offset,
				query: busca || undefined,
			}),
			meta: { silent: true },
		})
	);
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	const locationItems = [
		{ label: "Todos os locais", value: allLocations },
		...(locations.data?.items ?? []).map((item) => ({
			label: item.name,
			value: item.id,
		})),
	];

	const start = (item: BalanceItemView, next: MovementAction) => {
		setTarget(item);
		setAction(next);
		setDialogOpen(true);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Saldos</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/estoque/locais" />}
					variant="outline"
				>
					Gerenciar locais
				</ButtonLink>
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-end">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Material, variante ou código"
						type="search"
						value={query}
					/>
				</Field>
				<Field className="md:w-64">
					<FieldLabel>Local</FieldLabel>
					<Select
						items={locationItems}
						onValueChange={(value) =>
							navigate({
								search: (previous) => ({
									...previous,
									local: value === allLocations ? undefined : value,
								}),
							})
						}
						value={local ?? allLocations}
					/>
				</Field>
			</div>
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
							{clientCommandFailure(list.error, "material").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{busca || local
								? "Nenhum saldo encontrado"
								: "Nenhum saldo ainda"}
						</Heading>
						<Text tone="subtle">
							{busca || local
								? "Ajuste a busca ou o filtro de local."
								: "Cadastre uma variante de material e ela aparece aqui para receber o saldo de abertura."}
						</Text>
						<ButtonLink render={<Link to="/catalogo-produtos/materiais" />}>
							Ir para materiais
						</ButtonLink>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList aria-label="Saldos" columns="minmax(0,1fr) 9rem 9rem 7rem">
						<DataListHeader>
							<DataListHeaderCell>Variante</DataListHeaderCell>
							<DataListHeaderCell align="end">Saldo</DataListHeaderCell>
							<DataListHeaderCell align="end">Valor</DataListHeaderCell>
							<DataListHeaderCell align="end">Ações</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.variantId}>
								<DataListCell label="Variante">
									<div className="flex flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<Button
												className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
												onClick={() =>
													setOpened(
														opened === item.variantId ? null : item.variantId
													)
												}
												variant="link"
											>
												{item.materialName} · {item.variantName}
											</Button>
											{item.tracksLots ? (
												<Badge tone="neutral">por lote</Badge>
											) : null}
										</div>
										{item.code ? (
											<Text size="sm" tone="subtle">
												{item.code}
											</Text>
										) : null}
									</div>
								</DataListCell>
								<DataListCell align="end" label="Saldo">
									<Text inline numeric>
										{balanceQuantity(item)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Valor">
									<Text inline numeric>
										{balanceValue(item.valueCents)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Ações">
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button
													aria-label={`Ações de ${item.variantName}`}
													size="sm"
													variant="outline"
												/>
											}
										>
											Lançar
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											<DropdownMenuItem onClick={() => start(item, "opening")}>
												Saldo de abertura
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => start(item, "adjustment")}
											>
												Ajustar
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => start(item, "transfer")}>
												Transferir
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</DataListCell>
								{opened === item.variantId ? (
									<VariantBalancePanel item={item} />
								) : null}
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
			{target ? (
				<MovementDialog
					action={action}
					onOpenChange={setDialogOpen}
					open={dialogOpen}
					referenceCostCents={target.referenceCostCents}
					variant={target}
				/>
			) : null}
		</div>
	);
}
