import { expect, test } from "bun:test";

import { signInErrorMessage } from "../src/lib/sign-in-error";

test("credencial recusada não revela se o usuário existe", () => {
	expect(signInErrorMessage(401)).toBe("Usuário ou senha inválidos");
	expect(signInErrorMessage(422)).toBe("Usuário ou senha inválidos");
});

test("excesso de tentativas pede para esperar", () => {
	expect(signInErrorMessage(429)).toBe(
		"Muitas tentativas. Tente de novo mais tarde."
	);
});

test("qualquer outro status vira mensagem própria, nunca o texto do Better Auth", () => {
	for (const status of [0, 403, 404, 500, 503]) {
		expect(signInErrorMessage(status)).toBe(
			"Não foi possível entrar agora. Tente de novo."
		);
	}
});
