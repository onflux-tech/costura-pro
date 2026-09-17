import { describe, expect, test } from "bun:test";

import { clientListSearch } from "../src/atendimento/client-list-search";

describe("busca da lista de clientes na URL", () => {
	test("aceita busca e arquivados e descarta valor estranho", () => {
		expect(clientListSearch.parse({ arquivados: 1, busca: "joao" })).toEqual({
			arquivados: 1,
			busca: "joao",
		});
		expect(clientListSearch.parse({ arquivados: "sim", busca: 42 })).toEqual(
			{}
		);
		expect(clientListSearch.parse({ busca: "x".repeat(101) })).toEqual({});
	});
});
