import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
	type InventoryDraft,
	parseDraft,
	serializeDraft,
} from "@/lib/inventory";

import { createDraftStore, type DraftStorage } from "./draft-store";

const draftKey = "costura-pro:contagem-de-inventario";

function browserStorage(): DraftStorage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

const store = createDraftStore(browserStorage(), draftKey);

const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key === draftKey || event.key === null) {
			listener();
		}
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

const serverSnapshot = () => null;

export function useInventoryDraft() {
	const raw = useSyncExternalStore(subscribe, store.read, serverSnapshot);
	const draft = useMemo(() => parseDraft(raw), [raw]);
	const save = useCallback((next: InventoryDraft | null) => {
		store.write(next ? serializeDraft(next) : null);
		notify();
	}, []);
	const update = useCallback(
		(change: (current: InventoryDraft) => InventoryDraft) => {
			const current = parseDraft(store.read());
			if (current) {
				store.write(serializeDraft(change(current)));
				notify();
			}
		},
		[]
	);
	return { draft, failed: store.failed(), save, update };
}
