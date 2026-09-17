import { useSuspenseQuery } from "@tanstack/react-query";

import type { Gate } from "./installation-gates";
import { statusQuery } from "./installation-queries";
import { sessionQuery } from "./session";

export function useGate(): Gate {
	const { data: status } = useSuspenseQuery(statusQuery);
	const { data: session } = useSuspenseQuery(sessionQuery);
	return {
		access: status.access,
		signedIn: session !== null,
		state: status.state,
	};
}
