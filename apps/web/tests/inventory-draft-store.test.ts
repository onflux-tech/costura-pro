import { describe, expect, test } from "bun:test";

import {
	createDraftStore,
	type DraftStorage,
} from "../src/inventory/draft-store";

const key = "costura-pro:contagem-de-inventario";

function memoryStorage(): DraftStorage {
	const values = new Map<string, string>();
	return {
		getItem: (name) => values.get(name) ?? null,
		removeItem: (name) => {
			values.delete(name);
		},
		setItem: (name, value) => {
			values.set(name, value);
		},
	};
}

describe("createDraftStore", () => {
	test("lê o que gravou no armazenamento do aparelho", () => {
		const storage = memoryStorage();
		const store = createDraftStore(storage, key);
		store.write("a");
		expect(store.read()).toBe("a");
		expect(storage.getItem(key)).toBe("a");
		expect(store.failed()).toBe(false);
		store.write(null);
		expect(store.read()).toBeNull();
		expect(storage.getItem(key)).toBeNull();
	});

	test("guarda na memória quando a gravação falha", () => {
		const storage: DraftStorage = {
			...memoryStorage(),
			setItem: () => {
				throw new Error("cota cheia");
			},
		};
		const store = createDraftStore(storage, key);
		store.write("b");
		expect(store.read()).toBe("b");
		expect(store.failed()).toBe(true);
	});

	test("guarda na memória quando a leitura falha", () => {
		const storage: DraftStorage = {
			...memoryStorage(),
			getItem: () => {
				throw new Error("bloqueado");
			},
		};
		const store = createDraftStore(storage, key);
		expect(store.read()).toBeNull();
		store.write("c");
		expect(store.read()).toBe("c");
		expect(store.failed()).toBe(true);
	});

	test("apaga o armazenamento mesmo depois de cair para a memória", () => {
		const storage = memoryStorage();
		const store = createDraftStore(
			{
				...storage,
				setItem: (name, value) => {
					if (value === "b") {
						throw new Error("cota cheia");
					}
					storage.setItem(name, value);
				},
			},
			key
		);
		store.write("a");
		store.write("b");
		expect(store.read()).toBe("b");
		store.write(null);
		expect(store.read()).toBeNull();
		expect(storage.getItem(key)).toBeNull();
	});

	test("funciona só na memória sem armazenamento", () => {
		const store = createDraftStore(null, key);
		expect(store.read()).toBeNull();
		store.write("d");
		expect(store.read()).toBe("d");
		expect(store.failed()).toBe(true);
	});
});
