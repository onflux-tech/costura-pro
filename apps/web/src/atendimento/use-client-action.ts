import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { failedClientCommand, refreshClients } from "./client-queries";

export function useClientAction() {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<string | null>(null);
	const run = async (
		label: string,
		command: () => Promise<unknown>,
		subject: "cliente" | "perfil"
	) => {
		setPending(label);
		try {
			await command();
		} catch (error) {
			const failure = await failedClientCommand(queryClient, error, subject);
			toast.error(failure.message);
		} finally {
			setPending(null);
			await refreshClients(queryClient);
		}
	};
	return { pending, run };
}
