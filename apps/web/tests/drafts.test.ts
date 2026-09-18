import { describe, expect, test } from "bun:test";

import { createDraft } from "../src/lib/drafts";

const UUID = /^[0-9a-f-]{36}$/;

describe("rascunho de comando", () => {
	test("guarda os ids e repete o opId enquanto o conteúdo não muda", () => {
		const draft = createDraft();
		const first = draft.opIdFor("abertura:1000");
		expect(draft.opIdFor("abertura:1000")).toBe(first);
		expect(draft.movementId).toMatch(UUID);
		expect(draft.inboundId).not.toBe(draft.movementId);
		const changed = draft.opIdFor("abertura:2000");
		expect(changed).not.toBe(first);
		expect(draft.opIdFor("abertura:2000")).toBe(changed);
	});

	test("dois rascunhos não dividem ids nem opId", () => {
		const one = createDraft();
		const other = createDraft();
		expect(one.movementId).not.toBe(other.movementId);
		expect(one.opIdFor("x")).not.toBe(other.opIdFor("x"));
	});
});
