export type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export type DraftStore = {
	failed: () => boolean;
	read: () => string | null;
	write: (value: string | null) => void;
};

export function createDraftStore(
	storage: DraftStorage | null,
	key: string
): DraftStore {
	let memory: { value: string | null } | null = null;
	const remember = (value: string | null) => {
		memory = { value };
		return value;
	};
	return {
		failed: () => memory !== null || storage === null,
		read: () => {
			if (memory) {
				return memory.value;
			}
			if (storage === null) {
				return null;
			}
			try {
				return storage.getItem(key);
			} catch {
				return remember(null);
			}
		},
		write: (value) => {
			if (memory || storage === null) {
				remember(value);
				if (value === null && storage !== null) {
					try {
						storage.removeItem(key);
					} catch {
						return;
					}
				}
				return;
			}
			try {
				if (value === null) {
					storage.removeItem(key);
				} else {
					storage.setItem(key, value);
				}
			} catch {
				remember(value);
			}
		},
	};
}
