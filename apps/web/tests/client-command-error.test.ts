import { describe, expect, test } from "bun:test";
import { commandMessages } from "@costura-pro/api/command-messages";
import { ORPCError } from "@orpc/client";

import { clientCommandFailure } from "../src/lib/client-command-error";

describe("falhas de comando de cliente", () => {
	test("versão velha pede para carregar a versão atual", () => {
		const error = new ORPCError("CONFLICT", {
			message: commandMessages.staleVersion,
		});
		expect(clientCommandFailure(error, "cliente")).toEqual({
			kind: "stale",
			message: "Este cliente mudou em outra janela ou aparelho.",
		});
		expect(clientCommandFailure(error, "perfil").message).toBe(
			"Este perfil mudou em outra janela ou aparelho."
		);
		expect(clientCommandFailure(error, "medição").message).toBe(
			"Esta medição mudou em outra janela ou aparelho."
		);
		expect(clientCommandFailure(error, "modelo").message).toBe(
			"Este modelo mudou em outra janela ou aparelho."
		);
		expect(clientCommandFailure(error, "contagem").message).toBe(
			"Esta contagem mudou em outra janela ou aparelho."
		);
	});

	test("registro já gravado vira exists, e opId reutilizado segue genérico", () => {
		expect(
			clientCommandFailure(
				new ORPCError("CONFLICT", { message: commandMessages.aggregateExists }),
				"cliente"
			)
		).toEqual({
			kind: "exists",
			message: "Este cadastro já tinha sido salvo.",
		});
		expect(
			clientCommandFailure(
				new ORPCError("CONFLICT", {
					message: "opId reutilizado com conteúdo diferente",
				}),
				"cliente"
			)
		).toEqual({
			kind: "other",
			message:
				"Este cadastro já foi enviado com outros dados. Recarregue a tela.",
		});
	});

	test("cliente anonimizado e não encontrado", () => {
		expect(
			clientCommandFailure(
				new ORPCError("PRECONDITION_FAILED", {
					message: commandMessages.clientAnonymized,
				}),
				"perfil"
			)
		).toEqual({ kind: "anonymized", message: "Este cliente foi anonimizado." });
		expect(
			clientCommandFailure(
				new ORPCError("NOT_FOUND", { message: commandMessages.clientNotFound }),
				"cliente"
			)
		).toEqual({ kind: "other", message: commandMessages.clientNotFound });
	});

	test("rede e sessão seguem as mensagens gerais", () => {
		expect(
			clientCommandFailure(new TypeError("fetch failed"), "cliente").message
		).toBe("Não foi possível falar com o servidor. Tente de novo.");
		expect(
			clientCommandFailure(new ORPCError("UNAUTHORIZED"), "cliente").message
		).toBe("Sua sessão terminou. Entre de novo.");
	});
});

describe("falhas de orçamento", () => {
	test("versão velha e cliente anonimizado", () => {
		expect(
			clientCommandFailure(
				new ORPCError("CONFLICT", { message: commandMessages.staleVersion }),
				"orçamento"
			)
		).toEqual({
			kind: "stale",
			message: "Este orçamento mudou em outra janela ou aparelho.",
		});
		expect(
			clientCommandFailure(
				new ORPCError("PRECONDITION_FAILED", {
					message: commandMessages.clientAnonymized,
				}),
				"orçamento"
			)
		).toEqual({ kind: "anonymized", message: "Este cliente foi anonimizado." });
	});
});

describe("falhas de compra e finanças", () => {
	test("pagamento repetido, estorno repetido e compra já estornada viram exists", () => {
		const cases = [
			[commandMessages.obligationPaid, "Esta obrigação já foi paga."],
			[commandMessages.purchaseReversed, "Esta compra já foi estornada."],
			[
				commandMessages.financialMovementReversed,
				"Este movimento já foi estornado.",
			],
		] as const;
		for (const [message, expected] of cases) {
			expect(
				clientCommandFailure(new ORPCError("CONFLICT", { message }), "compra")
			).toEqual({ kind: "exists", message: expected });
		}
	});

	test("versão velha de conta, fornecedor e compra", () => {
		const error = new ORPCError("CONFLICT", {
			message: commandMessages.staleVersion,
		});
		expect(clientCommandFailure(error, "conta").message).toBe(
			"Esta conta mudou em outra janela ou aparelho."
		);
		expect(clientCommandFailure(error, "fornecedor").message).toBe(
			"Este fornecedor mudou em outra janela ou aparelho."
		);
	});

	test("obrigação cancelada chega com a mensagem do servidor", () => {
		expect(
			clientCommandFailure(
				new ORPCError("NOT_FOUND", {
					message: commandMessages.obligationCancelled,
				}),
				"compra"
			)
		).toEqual({ kind: "other", message: commandMessages.obligationCancelled });
	});
});

describe("pré-condição fora de cliente", () => {
	test("só cliente, perfil, medição e peça leem PRECONDITION_FAILED como anonimizado", () => {
		const error = new ORPCError("PRECONDITION_FAILED", {
			message: "Instalação ainda no wizard",
		});
		expect(clientCommandFailure(error, "peça").kind).toBe("anonymized");
		expect(clientCommandFailure(error, "compra")).toEqual({
			kind: "other",
			message: "A configuração avançou em outra janela. A tela foi atualizada.",
		});
	});
});
