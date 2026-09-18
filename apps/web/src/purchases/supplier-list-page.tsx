import { formatPhone } from "@costura-pro/domain/client";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
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
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { clientCommandFailure } from "@/lib/client-command-error";
import type { SupplierView } from "@/lib/purchases";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	failedPurchaseCommand,
	refreshPurchases,
	suppliersQuery,
} from "./purchase-queries";
import { SupplierDialog } from "./supplier-dialog";

const route = getRouteApi("/_app/compras/fornecedores");

function contactOf(supplier: SupplierView): string {
	return [supplier.phone ? formatPhone(supplier.phone) : null, supplier.email]
		.filter(Boolean)
		.join(" · ");
}

export function SupplierListPage() {
	const { arquivados, busca = "" } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [query, setQuery] = useState(busca);
	const [editing, setEditing] = useState<SupplierView | null>(null);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	usePageHeader({ eyebrow: "Compras", heading: "Fornecedores" });

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

	const list = useInfiniteQuery(suppliersQuery(archived, busca || undefined));
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];

	const toggleArchive = async (supplier: SupplierView) => {
		setBusy(supplier.id);
		try {
			const input = {
				baseVersion: supplier.version,
				opId: opIdFor(`${supplier.id}:${supplier.version}`),
				supplierId: supplier.id,
			};
			if (supplier.archivedAt) {
				await api.suppliers.unarchive(input);
			} else {
				await api.suppliers.archive(input);
			}
			await refreshPurchases(queryClient);
		} catch (error) {
			const failed = await failedPurchaseCommand(
				queryClient,
				error,
				"fornecedor"
			);
			toast.error(failed.message);
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Fornecedores</Heading>
				<Button
					className="max-md:w-full"
					onClick={() => {
						setEditing(null);
						setOpen(true);
					}}
				>
					Novo fornecedor
				</Button>
			</div>
			<div className="flex flex-col gap-3 md:flex-row md:items-end">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={100}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Nome, telefone ou e-mail"
						type="search"
						value={query}
					/>
				</Field>
				<ChoiceChips
					aria-label="Situação"
					onValueChange={(value) =>
						navigate({
							search: (previous) => ({
								...previous,
								arquivados: value === "arquivados" ? (1 as const) : undefined,
							}),
						})
					}
					value={archived ? "arquivados" : "ativos"}
				>
					<ChoiceChip value="ativos">Ativos</ChoiceChip>
					<ChoiceChip value="arquivados">Arquivados</ChoiceChip>
				</ChoiceChips>
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
							{clientCommandFailure(list.error, "fornecedor").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{busca || archived
								? "Nenhum fornecedor encontrado"
								: "Nenhum fornecedor ainda"}
						</Heading>
						<Text tone="subtle">
							{busca || archived
								? "Ajuste a busca ou a situação."
								: "Cadastre a loja ou a pessoa de quem o ateliê compra material."}
						</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList aria-label="Fornecedores" columns="minmax(0,1fr) 20rem">
						<DataListHeader>
							<DataListHeaderCell>Fornecedor</DataListHeaderCell>
							<DataListHeaderCell align="end">Ações</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Fornecedor">
									<div className="flex flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<Text weight="semibold">{item.name}</Text>
											{item.archivedAt ? (
												<Badge tone="warning">arquivado</Badge>
											) : null}
										</div>
										{contactOf(item) ? (
											<Text size="sm" tone="subtle">
												{contactOf(item)}
											</Text>
										) : null}
										{item.notes ? (
											<Text size="sm" tone="subtle">
												{item.notes}
											</Text>
										) : null}
									</div>
								</DataListCell>
								<DataListCell align="end" label="Ações">
									<div className="flex flex-wrap gap-2 md:justify-end">
										<ButtonLink
											render={
												<Link
													search={{ fornecedor: item.id }}
													to="/compras/recebidas"
												/>
											}
											size="sm"
											variant="outline"
										>
											Ver compras
										</ButtonLink>
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
			{list.hasNextPage ? (
				<Button
					disabled={list.isFetchingNextPage}
					onClick={() => list.fetchNextPage()}
					variant="outline"
				>
					Carregar mais
				</Button>
			) : null}
			<SupplierDialog onOpenChange={setOpen} open={open} supplier={editing} />
		</div>
	);
}
