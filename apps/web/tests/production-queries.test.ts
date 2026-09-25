import { describe, expect, test } from "bun:test";
import { commandMessages } from "@costura-pro/api/command-messages";
import { ORPCError } from "@orpc/client";
import { QueryClient, type QueryKey } from "@tanstack/react-query";

import { sessionQuery } from "../src/lib/session";
import {
	boardQuery,
	failedProductionCommand,
	productionFlowQuery,
	refreshProduction,
} from "../src/production/production-queries";
import { refreshServiceOrders } from "../src/service-orders/service-order-queries";
import { orpc } from "../src/utils/orpc";

const serviceOrderId = "00000000-0000-4000-8000-000000000001";

function seeded() {
	const queryClient = new QueryClient();
	const keys: Record<string, QueryKey> = {
		board: boardQuery().queryKey,
		flow: productionFlowQuery().queryKey,
		materials: orpc.materials.key(),
		order: orpc.serviceOrders.get.queryKey({ input: { serviceOrderId } }),
		session: sessionQuery.queryKey,
	};
	for (const key of Object.values(keys)) {
		queryClient.setQueryData(key, { seeded: true });
	}
	const invalidated = (name: string) =>
		queryClient.getQueryState(keys[name] ?? [])?.isInvalidated ?? false;
	return { invalidated, queryClient };
}

describe("consultas de produção", () => {
	test("o fluxo e o quadro não disparam o toast global de falha", () => {
		expect(productionFlowQuery().meta).toEqual({ silent: true });
		expect(boardQuery().meta).toEqual({ silent: true });
	});

	test("reler a produção invalida o fluxo, o quadro e as OS, e nada mais", async () => {
		const { invalidated, queryClient } = seeded();
		await refreshProduction(queryClient);
		expect(invalidated("flow")).toBe(true);
		expect(invalidated("board")).toBe(true);
		expect(invalidated("order")).toBe(true);
		expect(invalidated("materials")).toBe(false);
		expect(invalidated("session")).toBe(false);
	});

	test("reler as OS também relê o quadro", async () => {
		const { invalidated, queryClient } = seeded();
		await refreshServiceOrders(queryClient);
		expect(invalidated("board")).toBe(true);
	});

	test("versão velha vira stale e relê a produção", async () => {
		const { invalidated, queryClient } = seeded();
		const failure = await failedProductionCommand(
			queryClient,
			new ORPCError("CONFLICT", { message: commandMessages.staleVersion })
		);
		expect(failure.kind).toBe("stale");
		expect(invalidated("order")).toBe(true);
		expect(invalidated("board")).toBe(true);
		expect(invalidated("session")).toBe(false);
	});

	test("falha de rede relê a produção e mantém a mensagem genérica", async () => {
		const { invalidated, queryClient } = seeded();
		const failure = await failedProductionCommand(
			queryClient,
			new TypeError("Failed to fetch")
		);
		expect(failure.kind).toBe("other");
		expect(invalidated("order")).toBe(true);
	});

	test("subitem sumido traz a mensagem do servidor", async () => {
		const { queryClient } = seeded();
		const failure = await failedProductionCommand(
			queryClient,
			new ORPCError("NOT_FOUND", {
				message: commandMessages.productionItemNotFound,
			})
		);
		expect(failure).toEqual({
			kind: "other",
			message: commandMessages.productionItemNotFound,
		});
	});

	test("sessão encerrada relê a sessão", async () => {
		const { invalidated, queryClient } = seeded();
		await failedProductionCommand(
			queryClient,
			new ORPCError("UNAUTHORIZED", { message: "Unauthorized" })
		);
		expect(invalidated("session")).toBe(true);
	});
});
