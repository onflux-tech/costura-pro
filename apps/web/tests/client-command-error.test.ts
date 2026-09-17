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
