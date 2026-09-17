import { commandMessages } from "@costura-pro/api/command-messages";
import { ORPCError } from "@orpc/client";

import { commandErrorMessage } from "./command-error";

export type ClientCommandFailure = {
	kind: "anonymized" | "exists" | "other" | "stale";
	message: string;
};

export function clientCommandFailure(
	error: unknown,
	subject: "cliente" | "perfil"
): ClientCommandFailure {
	if (!(error instanceof ORPCError)) {
		return { kind: "other", message: commandErrorMessage(error) };
	}
	if (
		error.code === "CONFLICT" &&
		error.message === commandMessages.staleVersion
	) {
		return {
			kind: "stale",
			message: `Este ${subject} mudou em outra janela ou aparelho.`,
		};
	}
	if (
		error.code === "CONFLICT" &&
		error.message === commandMessages.aggregateExists
	) {
		return { kind: "exists", message: "Este cadastro já tinha sido salvo." };
	}
	if (error.code === "PRECONDITION_FAILED") {
		return { kind: "anonymized", message: "Este cliente foi anonimizado." };
	}
	if (error.code === "CONFLICT") {
		return {
			kind: "other",
			message:
				"Este cadastro já foi enviado com outros dados. Recarregue a tela.",
		};
	}
	if (error.code === "NOT_FOUND") {
		return { kind: "other", message: error.message };
	}
	return { kind: "other", message: commandErrorMessage(error) };
}
