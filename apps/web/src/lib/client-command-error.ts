import { commandMessages } from "@costura-pro/api/command-messages";
import { ORPCError } from "@orpc/client";

import { commandErrorMessage } from "./command-error";

export type ClientCommandFailure = {
	kind: "anonymized" | "exists" | "other" | "stale";
	message: string;
};

export type CommandSubject =
	| "cliente"
	| "local"
	| "lote"
	| "material"
	| "medição"
	| "modelo"
	| "peça"
	| "perfil"
	| "variante";

const staleMessages: Record<CommandSubject, string> = {
	cliente: "Este cliente mudou em outra janela ou aparelho.",
	local: "Este local mudou em outra janela ou aparelho.",
	lote: "Este lote mudou em outra janela ou aparelho.",
	material: "Este material mudou em outra janela ou aparelho.",
	medição: "Esta medição mudou em outra janela ou aparelho.",
	modelo: "Este modelo mudou em outra janela ou aparelho.",
	perfil: "Este perfil mudou em outra janela ou aparelho.",
	peça: "Esta peça mudou em outra janela ou aparelho.",
	variante: "Esta variante mudou em outra janela ou aparelho.",
};

export function clientCommandFailure(
	error: unknown,
	subject: CommandSubject
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
			message: staleMessages[subject],
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
