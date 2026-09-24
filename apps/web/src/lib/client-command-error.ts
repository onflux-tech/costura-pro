import { commandMessages } from "@costura-pro/api/command-messages";
import { ORPCError } from "@orpc/client";

import { commandErrorMessage } from "./command-error";

export type ClientCommandFailure = {
	kind: "anonymized" | "exists" | "other" | "stale";
	message: string;
};

export type CommandSubject =
	| "cliente"
	| "compra"
	| "conta"
	| "contagem"
	| "fornecedor"
	| "local"
	| "lote"
	| "material"
	| "medição"
	| "meta"
	| "modelo"
	| "OS"
	| "orçamento"
	| "peça"
	| "perfil"
	| "produto"
	| "serviço"
	| "variante";

const staleMessages: Record<CommandSubject, string> = {
	cliente: "Este cliente mudou em outra janela ou aparelho.",
	compra: "Esta compra mudou em outra janela ou aparelho.",
	conta: "Esta conta mudou em outra janela ou aparelho.",
	contagem: "Esta contagem mudou em outra janela ou aparelho.",
	fornecedor: "Este fornecedor mudou em outra janela ou aparelho.",
	local: "Este local mudou em outra janela ou aparelho.",
	lote: "Este lote mudou em outra janela ou aparelho.",
	material: "Este material mudou em outra janela ou aparelho.",
	medição: "Esta medição mudou em outra janela ou aparelho.",
	meta: "A meta de margem mudou em outra janela ou aparelho.",
	modelo: "Este modelo mudou em outra janela ou aparelho.",
	OS: "Esta OS mudou em outra janela ou aparelho.",
	orçamento: "Este orçamento mudou em outra janela ou aparelho.",
	perfil: "Este perfil mudou em outra janela ou aparelho.",
	peça: "Esta peça mudou em outra janela ou aparelho.",
	produto: "Este produto mudou em outra janela ou aparelho.",
	serviço: "Este serviço mudou em outra janela ou aparelho.",
	variante: "Esta variante mudou em outra janela ou aparelho.",
};

const personalSubjects: ReadonlySet<CommandSubject> = new Set([
	"cliente",
	"medição",
	"orçamento",
	"peça",
	"perfil",
]);

const alreadyDone: readonly (readonly [string, string])[] = [
	[
		commandMessages.financialMovementReversed,
		"Este movimento já foi estornado.",
	],
	[commandMessages.obligationPaid, "Esta obrigação já foi paga."],
	[commandMessages.purchaseReversed, "Esta compra já foi estornada."],
	[commandMessages.quoteApproved, "Este orçamento já foi aprovado."],
	[commandMessages.stockMovementReversed, "Este movimento já foi estornado."],
];

export function quoteAlreadyApproved(error: unknown): boolean {
	return (
		error instanceof ORPCError &&
		error.code === "CONFLICT" &&
		error.message === commandMessages.quoteApproved
	);
}

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
	const done = alreadyDone.find(([message]) => message === error.message);
	if (error.code === "CONFLICT" && done) {
		return { kind: "exists", message: done[1] };
	}
	if (
		error.code === "PRECONDITION_FAILED" &&
		error.message === commandMessages.clientHasOpenWork
	) {
		return {
			kind: "other",
			message:
				"Este cliente tem OS aberta ou valor a receber. A anonimização fica disponível quando tudo estiver encerrado.",
		};
	}
	if (error.code === "PRECONDITION_FAILED" && personalSubjects.has(subject)) {
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
