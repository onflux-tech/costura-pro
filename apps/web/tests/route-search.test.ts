import { describe, expect, test } from "bun:test";

import { isUuid, optionalUuidSearch } from "../src/lib/route-search";

describe("parâmetros de rota", () => {
	test("busca com id inválido é ignorada sem erro", () => {
		expect(optionalUuidSearch.parse("nao-e-uuid")).toBeUndefined();
		expect(optionalUuidSearch.parse(undefined)).toBeUndefined();
		const id = "3f1c2b8e-4d5a-4c3b-9a1e-2f6d7c8b9a0e";
		expect(optionalUuidSearch.parse(id)).toBe(id);
	});

	test("id de caminho precisa ser UUID", () => {
		expect(isUuid("3f1c2b8e-4d5a-4c3b-9a1e-2f6d7c8b9a0e")).toBe(true);
		expect(isUuid("editar")).toBe(false);
	});
});
