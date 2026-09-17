import { describe, expect, test } from "bun:test";

import { destinations } from "../src/lib/destinations";
import { sectionTabs, sectionTabsFor } from "../src/lib/section-tabs";

describe("abas por destino", () => {
	test("Atendimento marca Clientes na lista, no formulário e na ficha", () => {
		for (const path of [
			"/atendimento/clientes",
			"/atendimento/clientes/novo",
			"/atendimento/clientes/3f1c/editar",
		]) {
			expect(sectionTabsFor("atendimento", path)).toEqual({
				activeId: "clientes",
				items: [
					{
						href: "/atendimento/clientes",
						id: "clientes",
						label: "Clientes",
					},
				],
			});
		}
	});

	test("Catálogo marca Modelos de medidas na lista e no editor", () => {
		for (const path of [
			"/catalogo-produtos/modelos-de-medidas",
			"/catalogo-produtos/modelos-de-medidas/3f1c",
		]) {
			expect(sectionTabsFor("catalogo", path)).toEqual({
				activeId: "modelos-de-medidas",
				items: [
					{
						href: "/catalogo-produtos/modelos-de-medidas",
						id: "modelos-de-medidas",
						label: "Modelos de medidas",
					},
				],
			});
		}
	});

	test("destino sem abas e rota fora do shell devolvem lista vazia", () => {
		expect(sectionTabsFor("agenda", "/agenda")).toEqual({
			activeId: undefined,
			items: [],
		});
		expect(sectionTabsFor(undefined, "/")).toEqual({
			activeId: undefined,
			items: [],
		});
	});

	test("cada aba mora dentro do caminho do seu destino", () => {
		for (const [id, tabs] of Object.entries(sectionTabs)) {
			const destination = destinations.find((item) => item.id === id);
			expect(destination).toBeDefined();
			for (const tab of tabs) {
				expect(tab.href.startsWith(`${destination?.href}/`)).toBe(true);
			}
		}
	});
});
