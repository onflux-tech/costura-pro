import { useCallback, useRef } from "react";

import { nextOpId, type OpIdSlot } from "./op-id";

export function useOpId() {
	const slot = useRef<OpIdSlot | null>(null);
	const opIdFor = useCallback((key: string) => {
		slot.current = nextOpId(slot.current, key, () => crypto.randomUUID());
		return slot.current.opId;
	}, []);
	const reset = useCallback(() => {
		slot.current = null;
	}, []);
	return { opIdFor, reset };
}
