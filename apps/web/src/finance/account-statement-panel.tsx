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

import { financialMovementKindLabel, signedMoney } from "@/lib/finance";
import { formatDay, localDay } from "@/lib/measurements";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import {
	accountMovementsQuery,
	failedFinanceCommand,
	refreshFinance,
} from "./finance-queries";

type ReversalIds = { counterpartId: string; movementId: string };

const financialMovementPageSize = 200;

export function AccountStatementPanel({ accountId }: { accountId: string }) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const movements = useQuery(accountMovementsQuery(accountId));
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
			await api.financialMovements.reverse({
				...(isTransfer ? { counterpartId: ids.counterpartId } : {}),
				movementId: ids.movementId,
				occurredOn,
				opId: opIdFor(`estorno:${movementId}:${occurredOn}`),
				reason: "Lançamento corrigido pelo dono",
				reversesMovementId: movementId,
			});
			await refreshFinance(queryClient);
			toast.success("Movimento estornado.");
		} catch (error) {
			const failed = await failedFinanceCommand(queryClient, error);
			toast.error(failed.message);
		} finally {
			setBusy(null);
		}
	};

	const history = movements.data?.items ?? [];

	return (
		<div className="flex flex-col gap-2 border-divider border-t p-4 md:col-span-full">
			<Heading level={3} size="title">
				Extrato
			</Heading>
			{movements.isPending ? <Skeleton className="h-10" /> : null}
			{history.length === 0 && movements.isSuccess ? (
				<Text tone="subtle">Nenhum movimento ainda.</Text>
			) : null}
			{history.length >= financialMovementPageSize ? (
				<Text size="sm" tone="subtle">
					{`Mostrando os ${financialMovementPageSize} movimentos mais recentes; o saldo soma todos.`}
				</Text>
			) : null}
			{history.length > 0 ? (
				<DataList
					aria-label="Movimentos da conta"
					columns="minmax(0,1fr) 9rem 8rem"
				>
					<DataListHeader>
						<DataListHeaderCell>Movimento</DataListHeaderCell>
						<DataListHeaderCell align="end">Valor</DataListHeaderCell>
						<DataListHeaderCell align="end">Ações</DataListHeaderCell>
					</DataListHeader>
					{history.map((movement) => (
						<DataListRow key={movement.id}>
							<DataListCell label="Movimento">
								<div className="flex flex-col gap-1">
									<div className="flex flex-wrap items-center gap-2">
										<Text weight="semibold">
											{financialMovementKindLabel(movement.kind)}
										</Text>
										{movement.reversedByMovementId ? (
											<Badge tone="warning">estornado</Badge>
										) : null}
									</div>
									<Text size="sm" tone="subtle">
										{formatDay(movement.occurredOn)}
										{movement.supplierName ? ` · ${movement.supplierName}` : ""}
										{movement.purchaseReference
											? ` · ${movement.purchaseReference}`
											: ""}
										{movement.reason ? ` · ${movement.reason}` : ""}
									</Text>
								</div>
							</DataListCell>
							<DataListCell align="end" label="Valor">
								<Text
									inline
									numeric
									tone={
										movement.amountCents.startsWith("-") ? "danger" : "default"
									}
								>
									{signedMoney(movement.amountCents)}
								</Text>
							</DataListCell>
							<DataListCell align="end" label="Ações">
								<StatementAction
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
		</div>
	);
}

function StatementAction({
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
	if (movement.reversedByMovementId || movement.kind === "reversal") {
		return movement.purchaseId ? (
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
		) : null;
	}
	return (
		<div className="flex flex-wrap gap-2 md:justify-end">
			{movement.purchaseId ? (
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
			) : null}
			<Button disabled={busy} onClick={onReverse} size="sm" variant="ghost">
				Estornar
			</Button>
		</div>
	);
}
