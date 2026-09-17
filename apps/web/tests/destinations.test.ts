import { describe, expect, test } from "bun:test";

import {
	mobileNavigation,
	type NavSection,
	navigationLayout,
} from "@costura-pro/ui/lib/navigation";

import { destinationGroups, destinations } from "../src/lib/destinations";

describe("destinos principais", () => {
	test("seguem a navegação principal do produto, na ordem", () => {
		expect(destinations.map((item) => item.label)).toEqual([
			"Hoje",
			"Agenda",
			"Atendimento",
			"Orçamentos",
			"OS",
			"Produção",
			"Vendas",
			"Catálogo",
			"Estoque",
			"Compras",
			"Finanças",
			"Relatórios",
			"Configurações",
		]);
	});

	test("a barra inferior do celular tem Hoje, Agenda, OS e Vendas", () => {
		expect(
			destinations.filter((item) => item.mobile).map((item) => item.label)
		).toEqual(["Hoje", "Agenda", "OS", "Vendas"]);
	});

	test("ids e caminhos são únicos", () => {
		expect(new Set(destinations.map((item) => item.id)).size).toBe(13);
		expect(new Set(destinations.map((item) => item.href)).size).toBe(13);
	});

	test("uso diário fica solto e o resto vai para Catálogo e estoque ou Gestão", () => {
		const labelsOf = (group?: string) =>
			destinations
				.filter((item) => item.group === group)
				.map((item) => item.label);
		expect(labelsOf()).toEqual([
			"Hoje",
			"Agenda",
			"Atendimento",
			"Orçamentos",
			"OS",
			"Produção",
			"Vendas",
		]);
		expect(labelsOf("catalogo-estoque")).toEqual([
			"Catálogo",
			"Estoque",
			"Compras",
		]);
		expect(labelsOf("gestao")).toEqual([
			"Finanças",
			"Relatórios",
			"Configurações",
		]);
		expect(destinationGroups.map((group) => group.label)).toEqual([
			"Catálogo e estoque",
			"Gestão",
		]);
	});
});

describe("navegação sobre os destinos reais", () => {
	const labels = (items: readonly { label: string }[]) =>
		items.map((item) => item.label);
	const sections = (list: readonly NavSection[]) =>
		list.map((section) => [
			section.group?.label ?? null,
			labels(section.items),
		]);
	const groupIds = new Set(destinationGroups.map((group) => group.id));

	test("todo grupo usado existe e todo grupo tem destino", () => {
		const used = new Set(
			destinations.flatMap((item) => (item.group ? [item.group] : []))
		);
		expect([...used].filter((id) => !groupIds.has(id))).toEqual([]);
		expect([...groupIds].filter((id) => !used.has(id))).toEqual([]);
	});

	test("a partir de 1280 px: diário solto e dois menus de grupo", () => {
		const layout = navigationLayout(destinations, destinationGroups, "xl");
		expect(labels(layout.inline)).toEqual([
			"Hoje",
			"Agenda",
			"Atendimento",
			"Orçamentos",
			"OS",
			"Produção",
			"Vendas",
		]);
		expect(sections(layout.menus)).toEqual([
			["Catálogo e estoque", ["Catálogo", "Estoque", "Compras"]],
			["Gestão", ["Finanças", "Relatórios", "Configurações"]],
		]);
		expect(layout.overflow).toEqual([]);
	});

	test("entre 768 e 1279 px: Produção e os grupos vão para Mais", () => {
		const layout = navigationLayout(destinations, destinationGroups, "md");
		expect(labels(layout.inline)).toEqual([
			"Hoje",
			"Agenda",
			"Atendimento",
			"Orçamentos",
			"OS",
			"Vendas",
		]);
		expect(sections(layout.overflow)).toEqual([
			[null, ["Produção"]],
			["Catálogo e estoque", ["Catálogo", "Estoque", "Compras"]],
			["Gestão", ["Finanças", "Relatórios", "Configurações"]],
		]);
	});

	test("abaixo de 768 px: barra inferior e Mais com soltos e grupos", () => {
		const { bar, more } = mobileNavigation(destinations, destinationGroups);
		expect(labels(bar)).toEqual(["Hoje", "Agenda", "OS", "Vendas"]);
		expect(sections(more)).toEqual([
			[null, ["Atendimento", "Orçamentos", "Produção"]],
			["Catálogo e estoque", ["Catálogo", "Estoque", "Compras"]],
			["Gestão", ["Finanças", "Relatórios", "Configurações"]],
		]);
	});
});
