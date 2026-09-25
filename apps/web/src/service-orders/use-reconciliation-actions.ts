import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { nextOpId, type OpIdSlot } from "@/lib/op-id";
import {
	type ReconciliationDraft,
	reconcileCommandFailure,
	reconciliationFields,
	reconciliationOpKey,
	reverseCommandFailure,
	reverseOpKey,
	reverseReconciliationFields,
} from "@/lib/reconciliation";
import type {
	ReconciliationView,
	ServiceOrderItemView,
} from "@/lib/service-orders";
import { sessionQuery } from "@/lib/session";
import { client as api } from "@/utils/orpc";

import { refreshReconciliation } from "./service-order-queries";

export type ReconcileTarget = Pick<
	ServiceOrderItemView,
	"id" | "line" | "reconciled" | "reconciliation" | "reservations"
>;

type KeptReconciliation = {
	draft: ReconciliationDraft | null;
	opIdFor: (key: string) => string;
	reconciliationId: string;
};

type KeptReversal = {
	movementIds: string[];
	opIdFor: (key: string) => string;
	reversalId: string;
};

function opIdSource(): (key: string) => string {
	let slot: OpIdSlot | null = null;
	return (key) => {
		slot = nextOpId(slot, key, () => crypto.randomUUID());
		return slot.opId;
	};
}

async function failed<Failure>(
	queryClient: QueryClient,
	error: unknown,
	failureOf: (error: unknown) => Failure
): Promise<Failure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	refreshReconciliation(queryClient);
	return failureOf(error);
}

export function useReconciliationActions() {
	const queryClient = useQueryClient();
	const drafts = useRef(new Map<string, KeptReconciliation>());
	const reversals = useRef(new Map<string, KeptReversal>());

	const keptFor = useCallback(
		(item: Pick<ReconcileTarget, "id" | "reconciliation">) => {
			const kept = drafts.current.get(item.id);
			if (kept && item.reconciliation?.id === kept.reconciliationId) {
				drafts.current.delete(item.id);
				return;
			}
			return kept;
		},
		[]
	);

	const keepDraft = useCallback(
		(
			item: Pick<ReconcileTarget, "id" | "reconciliation">,
			draft: ReconciliationDraft
		): KeptReconciliation => {
			const kept = keptFor(item) ?? {
				draft: null,
				opIdFor: opIdSource(),
				reconciliationId: crypto.randomUUID(),
			};
			const next = { ...kept, draft };
			drafts.current.set(item.id, next);
			return next;
		},
		[keptFor]
	);

	const draftOf = useCallback(
		(item: Pick<ReconcileTarget, "id" | "reconciliation">) =>
			keptFor(item)?.draft ?? null,
		[keptFor]
	);

	const forgetSettled = useCallback(
		(items: readonly Pick<ReconcileTarget, "id" | "reconciliation">[]) => {
			for (const item of items) {
				keptFor(item);
			}
		},
		[keptFor]
	);

	const reconcile = async (
		item: ReconcileTarget,
		draft: ReconciliationDraft
	): Promise<ClientCommandFailure | null> => {
		const kept = keepDraft(item, draft);
		const fields = reconciliationFields(draft, item.id);
		try {
			await api.serviceOrderItems.reconcile({
				...fields,
				opId: kept.opIdFor(reconciliationOpKey(kept.reconciliationId, fields)),
				reconciliationId: kept.reconciliationId,
			});
		} catch (error) {
			const failure = await failed(queryClient, error, reconcileCommandFailure);
			if (failure.kind === "exists") {
				drafts.current.delete(item.id);
			}
			return failure;
		}
		drafts.current.delete(item.id);
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
				line.parts.map(() => crypto.randomUUID())
			),
			opIdFor: opIdSource(),
			reversalId: crypto.randomUUID(),
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
			const failure = await failed(queryClient, error, reverseCommandFailure);
			if (failure.kind !== "exists") {
				return failure;
			}
			reversals.current.delete(reconciliation.id);
			toast.info(failure.message);
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
