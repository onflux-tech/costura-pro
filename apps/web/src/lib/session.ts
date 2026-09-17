import { queryOptions } from "@tanstack/react-query";

import { authClient } from "./auth-client";

export const sessionQuery = queryOptions({
	meta: { silent: true },
	queryFn: async () => {
		const { data, error } = await authClient.getSession();
		if (error) {
			throw new Error(error.message ?? "Sessão indisponível");
		}
		return data;
	},
	queryKey: ["auth", "session"],
	staleTime: 30_000,
});
