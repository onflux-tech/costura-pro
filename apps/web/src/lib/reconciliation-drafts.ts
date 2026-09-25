import { nextOpId, type OpIdSlot } from "./op-id";
import type { ReconciliationDraft } from "./reconciliation";

export type KeptReconciliation = {
	draft: ReconciliationDraft;
	opIdFor: (key: string) => string;
	reconciliationId: string;
};

type Target = { id: string; reconciled: boolean };

function opIdSource(create: () => string): (key: string) => string {
	let slot: OpIdSlot | null = null;
	return (key) => {
		slot = nextOpId(slot, key, create);
		return slot.opId;
	};
}

function withNewMovementIds(
	draft: ReconciliationDraft,
	create: () => string
): ReconciliationDraft {
	return {
		...draft,
		lines: draft.lines.map((line) => ({
			...line,
			parts: line.parts.map((part) => ({ ...part, movementId: create() })),
		})),
	};
}

export function reconciliationDrafts(create: () => string) {
	const entries = new Map<string, KeptReconciliation>();

	const live = (item: Target): KeptReconciliation | undefined => {
		if (item.reconciled) {
			entries.delete(item.id);
			return;
		}
		return entries.get(item.id);
	};

	return {
		draftOf: (item: Target): ReconciliationDraft | null =>
			live(item)?.draft ?? null,
		forget: (itemId: string) => {
			entries.delete(itemId);
		},
		forgetSettled: (items: readonly Target[]) => {
			for (const item of items) {
				live(item);
			}
		},
		keep: (itemId: string, draft: ReconciliationDraft): KeptReconciliation => {
			const kept = entries.get(itemId);
			const next = kept
				? { ...kept, draft }
				: {
						draft: withNewMovementIds(draft, create),
						opIdFor: opIdSource(create),
						reconciliationId: create(),
					};
			entries.set(itemId, next);
			return next;
		},
	};
}
