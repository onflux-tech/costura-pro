import { commandMessages } from "@costura-pro/api/command-messages";
import type { ObligationStatus } from "@costura-pro/domain/finance";
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
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Stat } from "@costura-pro/ui/components/stat";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";

import { PayObligationDialog } from "@/finance/pay-obligation-dialog";
import { clientCommandFailure } from "@/lib/client-command-error";
import { isOverdue, moneyLabel, obligationStatusLabel } from "@/lib/finance";
import { formatDay, localDay } from "@/lib/measurements";
import { packagingSummary, unitCostLabel } from "@/lib/purchases";
import { pointQuantity } from "@/lib/stock";
import { usePageHeader } from "@/shell/page-header";

import { purchaseQuery } from "./purchase-queries";
import { ReversePurchaseDialog } from "./reverse-purchase-dialog";

const route = getRouteApi("/_app/compras/recebidas/$compraId");

const statusTone: Record<ObligationStatus, "neutral" | "success" | "warning"> =
	{
		cancelled: "neutral",
		open: "warning",
		paid: "success",
	};

export function PurchaseDetailPage() {
	const { compraId } = route.useParams();
	const detail = useQuery(purchaseQuery(compraId));
	const [reverseOpen, setReverseOpen] = useState(false);
	const [payOpen, setPayOpen] = useState(false);
	const { data } = detail;
	usePageHeader({
		backHref: "/compras/recebidas",
		eyebrow: "Compras",
		heading: data ? data.purchase.supplierName : "Compra",
	});

	if (!data && detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!data) {
		const message = detail.isError
			? clientCommandFailure(detail.error, "compra").message
			: commandMessages.purchaseNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir esta compra</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/compras/recebidas" />}
						variant="outline"
					>
						Voltar para as compras
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const { items, obligation, purchase, reversal } = data;
	const overdue = isOverdue(
		obligation.dueOn,
		localDay(new Date()),
		obligation.status
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{purchase.supplierName}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text tone="subtle">
							{`Compra de ${formatDay(purchase.occurredOn)}`}
							{purchase.reference ? ` · ${purchase.reference}` : ""}
						</Text>
						{reversal ? <Badge tone="neutral">estornada</Badge> : null}
					</div>
				</div>
				{reversal ? null : (
					<Button
						className="max-md:w-full"
						onClick={() => setReverseOpen(true)}
						variant="outline"
					>
						Estornar compra
					</Button>
				)}
			</div>
			<Panel>
				<PanelContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<Stat label="Itens" value={moneyLabel(purchase.grossCents)} />
					<Stat label="Frete" value={moneyLabel(purchase.freightCents)} />
					<Stat label="Desconto" value={moneyLabel(purchase.discountCents)} />
					<Stat label="Total" value={moneyLabel(purchase.totalCents)} />
				</PanelContent>
			</Panel>
			<Panel>
				<PanelHeader>
					<PanelTitle>Itens e custo de aquisição</PanelTitle>
				</PanelHeader>
				<DataList
					aria-label="Itens da compra"
					columns="minmax(0,1fr) 10rem 9rem 11rem"
				>
					<DataListHeader>
						<DataListHeaderCell>Item</DataListHeaderCell>
						<DataListHeaderCell align="end">Entrou</DataListHeaderCell>
						<DataListHeaderCell align="end">Linha</DataListHeaderCell>
						<DataListHeaderCell align="end">Custo final</DataListHeaderCell>
					</DataListHeader>
					{items.map((item) => (
						<DataListRow key={item.movementId}>
							<DataListCell label="Item">
								<div className="flex flex-col gap-1">
									<Text weight="semibold">
										{`${item.materialName} · ${item.variantName}`}
									</Text>
									<Text size="sm" tone="subtle">
										{`${packagingSummary({ ...item, packageCountMicros: BigInt(item.packageCountMicros), packagingQuantityMicros: BigInt(item.packagingQuantityMicros) })} a ${moneyLabel(item.unitPriceCents)}`}
									</Text>
									<Text size="sm" tone="subtle">
										{item.locationName}
										{item.lotLabel ? ` · ${item.lotLabel}` : ""}
									</Text>
								</div>
							</DataListCell>
							<DataListCell align="end" label="Entrou">
								<Text inline numeric>
									{pointQuantity(
										item.quantityMicros,
										item.baseUnit,
										item.displayPrecision
									)}
								</Text>
							</DataListCell>
							<DataListCell align="end" label="Linha">
								<div className="flex flex-col gap-1 md:items-end">
									<Text inline numeric>
										{moneyLabel(item.grossCents)}
									</Text>
									{item.freightCents === "0" ? null : (
										<Text inline size="sm" tone="subtle">
											{`+${moneyLabel(item.freightCents)} frete`}
										</Text>
									)}
									{item.discountCents === "0" ? null : (
										<Text inline size="sm" tone="subtle">
											{`-${moneyLabel(item.discountCents)} desconto`}
										</Text>
									)}
								</div>
							</DataListCell>
							<DataListCell align="end" label="Custo final">
								<div className="flex flex-col gap-1 md:items-end">
									<Text inline numeric weight="semibold">
										{moneyLabel(item.valueCents)}
									</Text>
									<Text inline size="sm" tone="subtle">
										{unitCostLabel(
											BigInt(item.valueCents),
											BigInt(item.quantityMicros),
											item.baseUnit
										)}
									</Text>
								</div>
							</DataListCell>
						</DataListRow>
					))}
				</DataList>
			</Panel>
			<Panel>
				<PanelHeader>
					<PanelTitle>Pagamento</PanelTitle>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<Badge tone={statusTone[obligation.status]}>
							{obligationStatusLabel(obligation.status)}
						</Badge>
						{overdue ? <Badge tone="danger">vencida</Badge> : null}
					</div>
					{obligation.payment ? (
						<Text>
							{`Paga em ${formatDay(obligation.payment.occurredOn)} pela conta ${obligation.payment.accountName}.`}
						</Text>
					) : null}
					{obligation.status === "open" ? (
						<div className="flex flex-col items-start gap-2">
							<Text>{`Vence em ${formatDay(obligation.dueOn)}.`}</Text>
							<Button onClick={() => setPayOpen(true)}>Pagar</Button>
						</div>
					) : null}
					{reversal ? (
						<Text tone="subtle">
							{`Estornada em ${formatDay(reversal.occurredOn)}: ${reversal.reason}`}
						</Text>
					) : null}
					{purchase.notes ? (
						<Text size="sm" tone="subtle">
							{purchase.notes}
						</Text>
					) : null}
				</PanelContent>
			</Panel>
			<ReversePurchaseDialog
				itemCount={items.length}
				onOpenChange={setReverseOpen}
				open={reverseOpen}
				paid={obligation.status === "paid"}
				purchaseId={purchase.id}
			/>
			<PayObligationDialog
				obligation={{
					amountCents: obligation.amountCents,
					id: obligation.id,
					reference: purchase.reference,
					supplierName: purchase.supplierName,
				}}
				onOpenChange={setPayOpen}
				open={payOpen}
			/>
		</div>
	);
}
