import { useCallback, useRef } from "react";

import { nextOpId, type OpIdSlot } from "./op-id";

export type CommandDraft = {
	inboundId: string;
	movementId: string;
	opIdFor: (key: string) => string;
};

export function createDraft(): CommandDraft {
	let slot: OpIdSlot | null = null;
	return {
		inboundId: crypto.randomUUID(),
		movementId: crypto.randomUUID(),
		opIdFor: (key) => {
			slot = nextOpId(slot, key, () => crypto.randomUUID());
			return slot.opId;
		},
	};
}

export function useDrafts() {
	const drafts = useRef(new Map<string, CommandDraft>());
	const draftFor = useCallback((key: string) => {
		const kept = drafts.current.get(key);
		if (kept) {
			return kept;
		}
		const fresh = createDraft();
		drafts.current.set(key, fresh);
		return fresh;
	}, []);
	const forget = useCallback((key: string) => {
		drafts.current.delete(key);
	}, []);
	return { draftFor, forget };
}
