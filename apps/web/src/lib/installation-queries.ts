import type { QueryClient } from "@tanstack/react-query";

import { type client, orpc } from "@/utils/orpc";

import { commandErrorMessage, sessionEnded } from "./command-error";
import type { Gate } from "./installation-gates";
import { sessionQuery } from "./session";

export type InstallationDetails = Awaited<
	ReturnType<typeof client.installation.details>
>;

export const statusQuery = orpc.installation.status.queryOptions({
	meta: { silent: true },
	staleTime: 30_000,
});

export function detailsQueryOptions(enabled: boolean) {
	return orpc.installation.details.queryOptions({
		enabled,
		meta: { silent: true },
	});
}

export async function readGate(queryClient: QueryClient): Promise<Gate> {
	const [status, session] = await Promise.all([
		queryClient.query(statusQuery),
		queryClient.query(sessionQuery),
	]);
	return {
		access: status.access,
		signedIn: session !== null,
		state: status.state,
	};
}

export async function refreshInstallation(queryClient: QueryClient) {
	await queryClient.invalidateQueries({ queryKey: orpc.installation.key() });
}

export async function failedCommand(
	queryClient: QueryClient,
	error: unknown
): Promise<string> {
	if (sessionEnded(error)) {
		await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
	}
	await refreshInstallation(queryClient);
	return commandErrorMessage(error);
}
