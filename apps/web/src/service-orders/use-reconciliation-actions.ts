import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { nextOpId, type OpIdSlot } from "@/lib/op-id";
import {
	type CommandSettlement,
	type ReconciliationDraft,
	reconcileSettlement,
	reconciliationFields,
	reconciliationOpKey,
	reverseOpKey,
	reverseReconciliationFields,
	reverseSettlement,
} from "@/lib/reconciliation";
import { reconciliationDrafts } from "@/lib/reconciliation-drafts";
import type {
	ReconciliationView,
	ServiceOrderItemView,
} from "@/lib/service-orders";
import { sessionQuery } from "@/lib/session";
import { client as api } from "@/utils/orpc";

import { refreshReconciliation } from "./service-order-queries";

export type ReconcileTarget = Pick<
	ServiceOrderItemView,
	"id" | "line" | "reconciled" | "reservations"
>;

type KeptReversal = {
	movementIds: string[];
	opIdFor: (key: string) => string;
	reversalId: string;
};

const newId = () => crypto.randomUUID();

function opIdSource(): (key: string) => string {
	let slot: OpIdSlot | null = null;
	return (key) => {
		slot = nextOpId(slot, key, newId);
		return slot.opId;
	};
}

async function settled(
	queryClient: QueryClient,
	error: unknown,
	settlementOf: (error: unknown) => CommandSettlement
): Promise<CommandSettlement> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	refreshReconciliation(queryClient);
	return settlementOf(error);
}

export function useReconciliationActions() {
	const queryClient = useQueryClient();
	const [drafts] = useState(() => reconciliationDrafts(newId));
	const reversals = useRef(new Map<string, KeptReversal>());

	const draftOf = useCallback(
		(item: Pick<ReconcileTarget, "id" | "reconciled">) => drafts.draftOf(item),
		[drafts]
	);

	const keepDraft = useCallback(
		(item: Pick<ReconcileTarget, "id">, draft: ReconciliationDraft) =>
			drafts.keep(item.id, draft).draft,
		[drafts]
	);

	const forgetSettled = useCallback(
		(items: readonly Pick<ReconcileTarget, "id" | "reconciled">[]) =>
			drafts.forgetSettled(items),
		[drafts]
	);

	const reconcile = async (
		item: ReconcileTarget,
		draft: ReconciliationDraft
	): Promise<ClientCommandFailure | null> => {
		const kept = drafts.keep(item.id, draft);
		const fields = reconciliationFields(kept.draft, item.id);
		try {
			await api.serviceOrderItems.reconcile({
				...fields,
				opId: kept.opIdFor(reconciliationOpKey(kept.reconciliationId, fields)),
				reconciliationId: kept.reconciliationId,
			});
		} catch (error) {
			const outcome = await settled(queryClient, error, reconcileSettlement);
			if (outcome.kind === "notice") {
				drafts.forget(item.id);
				toast.info(outcome.message);
				return null;
			}
			if (outcome.failure.kind === "exists") {
				drafts.forget(item.id);
			}
			return outcome.failure;
		}
		drafts.forget(item.id);
		await refreshReconciliation(queryClient);
		toast.success("Materiais reconciliados e peça pronta.");
		return null;
	};

	const reverse = async (
		reconciliation: ReconciliationView,
		input: { occurredOn: string; reason: string }
	): Promise<ClientCommandFailure | null> => {
		const kept = reversals.current.get(reconciliation.id) ?? {
			movementIds: reconciliation.lines.flatMap((line) =>
				line.parts.map(() => newId())
			),
			opIdFor: opIdSource(),
			reversalId: newId(),
		};
		reversals.current.set(reconciliation.id, kept);
		const fields = reverseReconciliationFields({
			...input,
			movementIds: kept.movementIds,
			reconciliationId: reconciliation.id,
		});
		try {
			await api.serviceOrderItems.reverseReconciliation({
				...fields,
				opId: kept.opIdFor(reverseOpKey(fields)),
				reversalId: kept.reversalId,
			});
		} catch (error) {
			const outcome = await settled(queryClient, error, reverseSettlement);
			if (outcome.kind === "failed") {
				return outcome.failure;
			}
			reversals.current.delete(reconciliation.id);
			toast.info(outcome.message);
			return null;
		}
		reversals.current.delete(reconciliation.id);
		await refreshReconciliation(queryClient);
		toast.success("Reconciliação estornada.");
		return null;
	};

	return { draftOf, forgetSettled, keepDraft, reconcile, reverse };
}

export type ReconciliationActions = ReturnType<typeof useReconciliationActions>;
