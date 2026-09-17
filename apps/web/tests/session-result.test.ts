import { expect, test } from "bun:test";

import { sessionFromResult } from "../src/lib/session-result";

test("sem sessão é null, não erro", () => {
	expect(sessionFromResult({ data: null, error: null })).toBeNull();
});

test("sessão válida passa adiante", () => {
	const session = { user: { username: "dona.atelie" } };
	expect(sessionFromResult({ data: session, error: null })).toBe(session);
});

test("falha ao consultar a sessão vira erro, para a rota mostrar a tela de erro e não o login", () => {
	expect(() =>
		sessionFromResult({
			data: null,
			error: { message: "Failed to fetch", status: 0 },
		})
	).toThrow("Sessão indisponível");
});
