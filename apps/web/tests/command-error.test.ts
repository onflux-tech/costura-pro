import { expect, test } from "bun:test";
import { ORPCError } from "@orpc/client";

import { commandErrorMessage } from "../src/lib/command-error";

test("mensagem do servidor em pedido inválido sem problemas de campo", () => {
	expect(
		commandErrorMessage(
			new ORPCError("BAD_REQUEST", { message: "Pasta não encontrada" })
		)
	).toBe("Pasta não encontrada");
});

test("validação de entrada não expõe a mensagem em inglês", () => {
	expect(
		commandErrorMessage(
			new ORPCError("BAD_REQUEST", {
				data: { issues: [] },
				message: "Input validation failed",
			})
		)
	).toBe("Confira os campos e tente de novo.");
});

test("códigos conhecidos e desconhecidos", () => {
	expect(
		commandErrorMessage(
			new ORPCError("CONFLICT", { message: "Versão desatualizada" })
		)
	).toBe("A instalação mudou. Confira e envie de novo.");
	expect(commandErrorMessage(new ORPCError("FORBIDDEN"))).toBe(
		"Disponível só no acesso local do PC."
	);
	expect(commandErrorMessage(new ORPCError("UNAUTHORIZED"))).toBe(
		"Sua sessão terminou. Entre de novo."
	);
	expect(commandErrorMessage(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(
		"Não foi possível concluir. Tente de novo."
	);
	expect(commandErrorMessage(new TypeError("Failed to fetch"))).toBe(
		"Não foi possível falar com o servidor. Tente de novo."
	);
});
