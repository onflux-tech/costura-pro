import { describe, expect, test } from "bun:test";

import {
	highlightRanges,
	matchedVariants,
	matchesAll,
	normalizeText,
	searchTokens,
} from "./search";

describe("normalizeText e searchTokens", () => {
	test("tira acento, caixa e espaços repetidos", () => {
		expect(normalizeText("  João   DA Silva ")).toBe("joao da silva");
	});

	test("trecho de telefone com máscara vira dígitos e token vazio some", () => {
		expect(searchTokens("João (81) 99815-4402")).toEqual([
			"joao",
			"81",
			"998154402",
		]);
		expect(searchTokens("  . ")).toEqual([]);
		expect(searchTokens("50%")).toEqual(["50%"]);
	});
});

describe("matchesAll", () => {
	test("exige cada palavra como trecho do texto normalizado", () => {
		expect(matchesAll("Conceição Lima", ["conceicao", "lim"])).toBe(true);
		expect(matchesAll("Iná Costa", ["ina", "lima"])).toBe(false);
	});

	test("acha o telefone digitado com máscara", () => {
		expect(
			matchesAll("ana souza 11987654321", searchTokens("(11) 98765"))
		).toBe(true);
	});

	test("sem palavra, tudo casa", () => {
		expect(matchesAll("Iná", [])).toBe(true);
	});
});

describe("matchedVariants", () => {
	const cru = { id: "cru", searchText: "cru lin-cru" };
	const azul = { id: "azul", searchText: "azul" };
	const azulMarinho = { id: "azul-marinho", searchText: "azul marinho lin-az" };
	const misto = { id: "misto", searchText: "linho misto" };

	test("não destaca nada quando o pai tem todas as palavras", () => {
		expect(matchedVariants("linho tecidos", [cru, misto], ["linho"])).toEqual(
			[]
		);
	});

	test("destaca as variantes com as palavras que faltam ao pai", () => {
		expect(
			matchedVariants("linho tecidos", [cru, azul], ["linho", "cru"])
		).toEqual([cru]);
		expect(matchedVariants("linho tecidos", [azul, cru], ["lin-cru"])).toEqual([
			cru,
		]);
	});

	test("ordena por quantas palavras a variante tem e, no empate, pela ordem recebida", () => {
		expect(
			matchedVariants("linho", [azul, azulMarinho, cru], ["azul", "marinho"])
		).toEqual([azulMarinho, azul]);
		expect(
			matchedVariants("linho", [cru, azul, azulMarinho], ["azul"])
		).toEqual([azul, azulMarinho]);
	});

	test("mantém as variantes que têm só parte das palavras divididas entre elas", () => {
		expect(
			matchedVariants("linho", [cru, azul, misto], ["cru", "azul"])
		).toEqual([cru, azul]);
	});

	test("normaliza o texto cru do pai e das variantes antes de comparar", () => {
		const azulCru = { id: "azul-cru", searchText: "Azul Marinho" };
		const cruCru = { id: "cru-cru", searchText: "Crú" };
		expect(
			matchedVariants("LINHO", [azulCru, cruCru], ["linho", "azul"])
		).toEqual([azulCru]);
		expect(matchedVariants("Linho", [azulCru, cruCru], ["cru"])).toEqual([
			cruCru,
		]);
	});
});

describe("highlightRanges", () => {
	test("marca o trecho no texto original, sem acento nem maiúscula", () => {
		expect(highlightRanges("Conceição Lima", ["conce", "lim"])).toEqual([
			[0, 5],
			[10, 13],
		]);
		expect(highlightRanges("Conceição Lima", ["ceicao"])).toEqual([[3, 9]]);
	});

	test("marca cada ocorrência e funde trechos sobrepostos ou encostados", () => {
		expect(highlightRanges("Linho linho", ["linho", "lin"])).toEqual([
			[0, 5],
			[6, 11],
		]);
		expect(highlightRanges("abcdef", ["abc", "cde"])).toEqual([[0, 5]]);
		expect(highlightRanges("abcdef", ["abc", "def"])).toEqual([[0, 6]]);
	});

	test("devolve posições do original mesmo com o acento decomposto", () => {
		const decomposed = "Conceição Lima";
		expect(highlightRanges(decomposed, ["lima"])).toEqual([[12, 16]]);
		expect(highlightRanges(decomposed, ["ceicao"])).toEqual([[3, 11]]);
	});

	test("casa código com hífen como texto", () => {
		expect(highlightRanges("M · VM-M · R$ 289,90", ["vm-m"])).toEqual([[4, 8]]);
	});

	test("sem casamento, sem palavra ou sem texto, nenhum trecho", () => {
		expect(highlightRanges("Linho", ["zz"])).toEqual([]);
		expect(highlightRanges("Linho", [])).toEqual([]);
		expect(highlightRanges("", ["a"])).toEqual([]);
	});
});
