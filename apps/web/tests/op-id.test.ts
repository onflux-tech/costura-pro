import { expect, test } from "bun:test";

import { nextOpId, opIdsByTarget } from "../src/lib/op-id";

function sequence(...ids: string[]) {
	const pending = [...ids];
	return () => pending.shift() ?? "sobrando";
}

test("mesma entrada repete o opId e entrada nova gera outro", () => {
	const create = sequence("primeiro", "segundo");
	const first = nextOpId(null, "Ateliê", create);
	expect(first).toEqual({ key: "Ateliê", opId: "primeiro" });
	expect(nextOpId(first, "Ateliê", create)).toBe(first);
	expect(nextOpId(first, "Ateliê Linha Fina", create)).toEqual({
		key: "Ateliê Linha Fina",
		opId: "segundo",
	});
});

test("cada alvo guarda a própria chave, e a ação num alvo não troca o opId do outro", () => {
	const opIdFor = opIdsByTarget(sequence("a1", "b1", "a2"));
	expect(opIdFor("A")("A:advance:2")).toBe("a1");
	expect(opIdFor("B")("B:advance:5")).toBe("b1");
	expect(opIdFor("A")("A:advance:2")).toBe("a1");
	expect(opIdFor("B")("B:advance:5")).toBe("b1");
	expect(opIdFor("A")("A:advance:3")).toBe("a2");
});
