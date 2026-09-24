import { describe, expect, test } from "bun:test";

import { stockPointsQuery } from "../src/inventory/inventory-queries";

describe("stockPointsQuery", () => {
	test("renova os saldos dos locais enquanto a contagem está aberta", () => {
		expect(
			stockPointsQuery(["00000000-0000-4000-8000-000000000001"]).refetchInterval
		).toBe(15_000);
	});
});
