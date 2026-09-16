import { expect, test } from "bun:test";

import { canonicalJson } from "./canonical-json";

test("sorts keys recursively and keeps array order", () => {
	const unordered = JSON.parse('{"b":1,"a":{"d":[2,{"z":1,"y":2}],"c":null}}');
	expect(canonicalJson(unordered)).toBe(
		'{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}'
	);
});

test("yields the same text regardless of key order", () => {
	expect(canonicalJson(JSON.parse('{"y":"a","x":1}'))).toBe(
		canonicalJson(JSON.parse('{"x":1,"y":"a"}'))
	);
	expect(canonicalJson(JSON.parse('{"y":"a","x":1}'))).toBe('{"x":1,"y":"a"}');
});

test("drops undefined object values like JSON", () => {
	expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
});
