import type { QueryClient } from "@tanstack/react-query";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { sessionEnded } from "@/lib/command-error";
import { sessionQuery } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export function clientDetailQuery(clientId: string) {
	return orpc.clients.get.queryOptions({
		input: { clientId },
		meta: { silent: true },
	});
}

export async function refreshClients(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.clients.key() });
}

export async function failedClientCommand(
	queryClient: QueryClient,
	error: unknown,
	subject: "cliente" | "perfil"
): Promise<ClientCommandFailure> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	const failure = clientCommandFailure(error, subject);
	if (failure.kind !== "other") {
		await refreshClients(queryClient);
	}
	return failure;
}
