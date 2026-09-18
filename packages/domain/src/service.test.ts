import { expect, test } from "bun:test";

import { formatMinutes, serviceSearchKey } from "./service";

test("duração em minutos vira horas e minutos", () => {
	expect(formatMinutes(1)).toBe("1 min");
	expect(formatMinutes(45)).toBe("45 min");
	expect(formatMinutes(60)).toBe("1 h");
	expect(formatMinutes(90)).toBe("1 h 30 min");
	expect(formatMinutes(1500)).toBe("25 h");
});

test("chave de busca junta nome e categoria sem acento", () => {
	expect(serviceSearchKey({ category: "Barra", name: "Barra de calça" })).toBe(
		"barra de calca barra"
	);
	expect(serviceSearchKey({ category: null, name: "Bordado à mão" })).toBe(
		"bordado a mao"
	);
});
