import { queryOptions } from "@tanstack/react-query";

import { authClient } from "./auth-client";
import { sessionFromResult } from "./session-result";

export const sessionQuery = queryOptions({
	meta: { silent: true },
	queryFn: async () => sessionFromResult(await authClient.getSession()),
	queryKey: ["auth", "session"],
	staleTime: 30_000,
});
