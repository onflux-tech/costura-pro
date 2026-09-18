import type { ObligationStatus } from "@costura-pro/domain/finance";
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
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { isOverdue, moneyLabel, obligationStatusLabel } from "@/lib/finance";
import { formatDay, localDay } from "@/lib/measurements";
import { usePageHeader } from "@/shell/page-header";

import { obligationsQuery } from "./finance-queries";
import {
	type PayableObligation,
	PayObligationDialog,
} from "./pay-obligation-dialog";

const route = getRouteApi("/_app/financas/a-pagar");

const statusBySearch: Record<"canceladas" | "pagas", ObligationStatus> = {
	canceladas: "cancelled",
	pagas: "paid",
};

const emptyText: Record<ObligationStatus, [string, string]> = {
	cancelled: [
		"Nenhuma obrigação cancelada",
		"A obrigação de uma compra estornada aparece aqui.",
	],
	open: [
		"Nada a pagar",
		"A compra lançada como a pagar aparece aqui até ser quitada.",
	],
	paid: ["Nenhuma obrigação paga ainda", "As quitações aparecem aqui."],
};

export function ObligationListPage() {
	const { estado } = route.useSearch();
	const navigate = route.useNavigate();
	const status: ObligationStatus = estado ? statusBySearch[estado] : "open";
	const [paying, setPaying] = useState<PayableObligation | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const today = localDay(new Date());
	usePageHeader({ eyebrow: "Finanças", heading: "A pagar" });

	const list = useInfiniteQuery(obligationsQuery(status));
	const items = list.data?.pages.flatMap((page) => page.items) ?? [];
	const [emptyHeading, emptyHint] = emptyText[status];

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">A pagar</Heading>
			<ChoiceChips
				aria-label="Situação"
				onValueChange={(value) =>
					navigate({
						search: () => ({
							estado:
								value === "pagas" || value === "canceladas" ? value : undefined,
						}),
					})
				}
				value={estado ?? "abertas"}
			>
				<ChoiceChip value="abertas">Abertas</ChoiceChip>
				<ChoiceChip value="pagas">Pagas</ChoiceChip>
				<ChoiceChip value="canceladas">Canceladas</ChoiceChip>
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
							{clientCommandFailure(list.error, "compra").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{emptyHeading}
						</Heading>
						<Text tone="subtle">{emptyHint}</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList
						aria-label="Obrigações"
						columns="minmax(0,1fr) 8rem 9rem 10rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Fornecedor</DataListHeaderCell>
							<DataListHeaderCell>Vencimento</DataListHeaderCell>
							<DataListHeaderCell align="end">Valor</DataListHeaderCell>
							<DataListHeaderCell align="end">Ações</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Fornecedor">
									<div className="flex flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<Text weight="semibold">{item.supplierName}</Text>
											{isOverdue(item.dueOn, today, item.status) ? (
												<Badge tone="danger">vencida</Badge>
											) : null}
											{item.status === "open" ? null : (
												<Badge
													tone={item.status === "paid" ? "success" : "warning"}
												>
													{obligationStatusLabel(item.status).toLowerCase()}
												</Badge>
											)}
										</div>
										<Text size="sm" tone="subtle">
											{`Compra de ${formatDay(item.purchaseOccurredOn)}`}
											{item.reference ? ` · ${item.reference}` : ""}
											{item.paidOn
												? ` · paga em ${formatDay(item.paidOn)} (${item.paidAccountName ?? ""})`
												: ""}
										</Text>
									</div>
								</DataListCell>
								<DataListCell label="Vencimento">
									<Text inline numeric>
										{formatDay(item.dueOn)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Valor">
									<Text inline numeric>
										{moneyLabel(item.amountCents)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Ações">
									<div className="flex flex-wrap gap-2 md:justify-end">
										{item.status === "open" ? (
											<Button
												onClick={() => {
													setPaying(item);
													setDialogOpen(true);
												}}
												size="sm"
											>
												Pagar
											</Button>
										) : null}
										<ButtonLink
											render={
												<Link
													params={{ compraId: item.purchaseId }}
													to="/compras/recebidas/$compraId"
												/>
											}
											size="sm"
											variant="ghost"
										>
											Ver compra
										</ButtonLink>
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
			{paying ? (
				<PayObligationDialog
					obligation={paying}
					onOpenChange={setDialogOpen}
					open={dialogOpen}
				/>
			) : null}
		</div>
	);
}
