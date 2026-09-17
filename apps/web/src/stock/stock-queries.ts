import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	type CommandSubject,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function stockLocationsQuery(archived = false) {
	return orpc.stockLocations.list.queryOptions({
		input: { archived },
		meta: { silent: true },
	});
}

export function stockLotsQuery(variantId: string) {
	return orpc.stockLots.list.queryOptions({
		input: { variantId },
		meta: { silent: true },
	});
}

export function variantBalanceQuery(variantId: string) {
	return orpc.stockBalances.get.queryOptions({
		input: { variantId },
		meta: { silent: true },
	});
}

export function variantMovementsQuery(variantId: string) {
	return orpc.stockMovements.list.queryOptions({
		input: { variantId },
		meta: { silent: true },
	});
}

export async function refreshStock(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.stockBalances.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.stockMovements.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.stockLocations.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.stockLots.key() });
	await queryClient.invalidateQueries({ queryKey: orpc.materials.key() });
}

export async function failedStockCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: CommandSubject = "material"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshStock(queryClient);
	}
	return failure;
}
