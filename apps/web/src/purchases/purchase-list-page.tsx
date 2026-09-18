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
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";

import { clientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { formatDay } from "@/lib/measurements";
import { type PurchaseStatus, purchaseStatusLabel } from "@/lib/purchases";
import { usePageHeader } from "@/shell/page-header";

import { purchasesQuery, supplierOptionsQuery } from "./purchase-queries";

const route = getRouteApi("/_app/compras/recebidas/");

const allSuppliers = "*";

const statusTone: Record<PurchaseStatus, "neutral" | "success" | "warning"> = {
	open: "warning",
	paid: "success",
	reversed: "neutral",
};

export function PurchaseListPage() {
	const { fornecedor } = route.useSearch();
	const navigate = route.useNavigate();
	const suppliers = useQuery(supplierOptionsQuery());
	usePageHeader({ eyebrow: "Compras", heading: "Compras" });

	const list = useInfiniteQuery(purchasesQuery(fornecedor));
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	const supplierItems = [
		{ label: "Todos os fornecedores", value: allSuppliers },
		...(suppliers.data?.items ?? []).map((supplier) => ({
			label:
				supplier.archivedAt === null
					? supplier.name
					: `${supplier.name} (arquivado)`,
			value: supplier.id,
		})),
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Compras</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/compras/recebidas/nova" />}
				>
					Nova compra
				</ButtonLink>
			</div>
			<Field className="md:w-80">
				<FieldLabel>Fornecedor</FieldLabel>
				<Select
					items={supplierItems}
					onValueChange={(value) =>
						navigate({
							search: () => ({
								fornecedor: value === allSuppliers ? undefined : value,
							}),
						})
					}
					value={fornecedor ?? allSuppliers}
				/>
			</Field>
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
							{clientCommandFailure(list.error, "compra").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{fornecedor
								? "Nenhuma compra deste fornecedor"
								: "Nenhuma compra ainda"}
						</Heading>
						<Text tone="subtle">
							A compra registra o que chegou, converte a embalagem para a
							unidade do estoque e divide frete e desconto entre os itens.
						</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList aria-label="Compras" columns="minmax(0,1fr) 7rem 9rem 8rem">
						<DataListHeader>
							<DataListHeaderCell>Compra</DataListHeaderCell>
							<DataListHeaderCell>Data</DataListHeaderCell>
							<DataListHeaderCell align="end">Total</DataListHeaderCell>
							<DataListHeaderCell align="end">Situação</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Compra">
									<div className="flex flex-col gap-1">
										<ButtonLink
											className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
											render={
												<Link
													params={{ compraId: item.id }}
													to="/compras/recebidas/$compraId"
												/>
											}
											variant="link"
										>
											{item.supplierName}
										</ButtonLink>
										<Text size="sm" tone="subtle">
											{item.itemCount === 1
												? "1 item"
												: `${item.itemCount} itens`}
											{item.reference ? ` · ${item.reference}` : ""}
											{item.status === "open"
												? ` · vence ${formatDay(item.dueOn)}`
												: ""}
										</Text>
									</div>
								</DataListCell>
								<DataListCell label="Data">
									<Text inline numeric>
										{formatDay(item.occurredOn)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Total">
									<Text inline numeric>
										{moneyLabel(item.totalCents)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Situação">
									<Badge tone={statusTone[item.status]}>
										{purchaseStatusLabel(item.status)}
									</Badge>
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
		</div>
	);
}
