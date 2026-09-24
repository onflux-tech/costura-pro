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
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { formatDay, localDay } from "@/lib/measurements";
import {
	type BalanceItemView,
	balanceValue,
	movementKindLabel,
	movementQuantity,
	pointQuantity,
} from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import {
	failedStockCommand,
	refreshStock,
	variantBalanceQuery,
	variantMovementsQuery,
} from "./stock-queries";

type ReversalIds = { counterpartId: string; movementId: string };

export function VariantBalancePanel({ item }: { item: BalanceItemView }) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const balance = useQuery(variantBalanceQuery(item.variantId));
	const movements = useQuery(variantMovementsQuery(item.variantId));
	const [busy, setBusy] = useState<string | null>(null);
	const drafts = useRef(new Map<string, ReversalIds>());
	const reversalIds = (movementId: string): ReversalIds => {
		const kept = drafts.current.get(movementId);
		if (kept) {
			return kept;
		}
		const fresh = {
			counterpartId: crypto.randomUUID(),
			movementId: crypto.randomUUID(),
		};
		drafts.current.set(movementId, fresh);
		return fresh;
	};

	const reverse = async (movementId: string, isTransfer: boolean) => {
		const ids = reversalIds(movementId);
		const occurredOn = localDay(new Date());
		setBusy(movementId);
		try {
			await api.stockMovements.reverse({
				...(isTransfer ? { counterpartId: ids.counterpartId } : {}),
				movementId: ids.movementId,
				occurredOn,
				opId: opIdFor(`estorno:${movementId}:${occurredOn}`),
				reason: "Lançamento corrigido pelo dono",
				reversesMovementId: movementId,
			});
			await refreshStock(queryClient);
			toast.success("Movimento estornado.");
		} catch (error) {
			const failed = await failedStockCommand(queryClient, error, "variante");
			toast.error(failed.message);
		} finally {
			setBusy(null);
		}
	};

	const points = balance.data?.points ?? [];
	const history = movements.data?.items ?? [];

	return (
		<div className="flex flex-col gap-4 border-divider border-t p-4 md:col-span-full">
			<section className="flex flex-col gap-2">
				<Heading level={3} size="title">
					Onde está
				</Heading>
				{balance.isPending ? <Skeleton className="h-10" /> : null}
				{points.length === 0 && balance.isSuccess ? (
					<Text tone="subtle">Sem saldo em nenhum local.</Text>
				) : null}
				{points.length > 0 ? (
					<DataList
						aria-label="Saldo por local"
						columns="minmax(0,1fr) 8rem 8rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Local</DataListHeaderCell>
							<DataListHeaderCell align="end">Quantidade</DataListHeaderCell>
							<DataListHeaderCell align="end">Valor</DataListHeaderCell>
						</DataListHeader>
						{points.map((point) => (
							<DataListRow key={`${point.locationId}:${point.lotId ?? "-"}`}>
								<DataListCell label="Local">
									<div className="flex flex-wrap items-center gap-2">
										<Text>{point.locationName}</Text>
										{point.lotLabel ? (
											<Badge tone="neutral">{point.lotLabel}</Badge>
										) : null}
									</div>
								</DataListCell>
								<DataListCell align="end" label="Quantidade">
									<Text inline numeric>
										{pointQuantity(
											point.quantityMicros,
											item.baseUnit,
											item.displayPrecision
										)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Valor">
									<Text inline numeric>
										{balanceValue(point.valueCents)}
									</Text>
								</DataListCell>
							</DataListRow>
						))}
					</DataList>
				) : null}
			</section>
			<section className="flex flex-col gap-2">
				<Heading level={3} size="title">
					Histórico
				</Heading>
				{movements.isPending ? <Skeleton className="h-10" /> : null}
				{history.length === 0 && movements.isSuccess ? (
					<Text tone="subtle">Nenhum movimento ainda.</Text>
				) : null}
				{history.length > 0 ? (
					<DataList
						aria-label="Movimentos"
						columns="minmax(0,1fr) 8rem 8rem 7rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Movimento</DataListHeaderCell>
							<DataListHeaderCell align="end">Quantidade</DataListHeaderCell>
							<DataListHeaderCell align="end">Valor</DataListHeaderCell>
							<DataListHeaderCell align="end">Ações</DataListHeaderCell>
						</DataListHeader>
						{history.map((movement) => (
							<DataListRow key={movement.id}>
								<DataListCell label="Movimento">
									<div className="flex flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<Text weight="semibold">
												{movementKindLabel(movement.kind)}
											</Text>
											{movement.reversedByMovementId ? (
												<Badge tone="warning">estornado</Badge>
											) : null}
										</div>
										<Text size="sm" tone="subtle">
											{formatDay(movement.occurredOn)} · {movement.locationName}
											{movement.lotLabel ? ` · ${movement.lotLabel}` : ""}
											{movement.reason ? ` · ${movement.reason}` : ""}
										</Text>
										{movement.inventorySessionId ? (
											<ButtonLink
												className="h-auto min-h-11 justify-start self-start px-0 md:min-h-0"
												render={
													<Link
														params={{ contagemId: movement.inventorySessionId }}
														to="/estoque/inventario/$contagemId"
													/>
												}
												size="sm"
												variant="link"
											>
												Ver contagem
											</ButtonLink>
										) : null}
									</div>
								</DataListCell>
								<DataListCell align="end" label="Quantidade">
									<Text inline numeric>
										{movementQuantity(
											movement.quantityMicros,
											item.baseUnit,
											item.displayPrecision
										)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Valor">
									<Text inline numeric>
										{balanceValue(movement.valueCents)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Ações">
									<MovementAction
										busy={busy === movement.id}
										movement={movement}
										onReverse={() =>
											reverse(movement.id, movement.transferId !== null)
										}
									/>
								</DataListCell>
							</DataListRow>
						))}
					</DataList>
				) : null}
			</section>
		</div>
	);
}

function MovementAction({
	busy,
	movement,
	onReverse,
}: {
	busy: boolean;
	movement: {
		kind: string;
		purchaseId: string | null;
		reversedByMovementId: string | null;
	};
	onReverse: () => void;
}) {
	if (movement.purchaseId) {
		return (
			<ButtonLink
				render={
					<Link
						params={{ compraId: movement.purchaseId }}
						to="/compras/recebidas/$compraId"
					/>
				}
				size="sm"
				variant="ghost"
			>
				Ver compra
			</ButtonLink>
		);
	}
	if (movement.reversedByMovementId || movement.kind === "reversal") {
		return null;
	}
	return (
		<Button disabled={busy} onClick={onReverse} size="sm" variant="ghost">
			Estornar
		</Button>
	);
}
