import { expect, test } from "bun:test";

import { nextOpId } from "../src/lib/op-id";

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
