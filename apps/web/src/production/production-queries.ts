import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function productionFlowQuery() {
	return orpc.productionFlow.get.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export function boardQuery() {
	return orpc.serviceOrderItems.board.queryOptions({
		input: {},
		meta: { silent: true },
	});
}

export async function refreshProduction(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: orpc.productionFlow.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.serviceOrderItems.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.serviceOrders.key() }),
	]);
}

export async function failedProductionCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "OS"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	await refreshProduction(queryClient);
	return clientCommandFailure(error, subject);
}
