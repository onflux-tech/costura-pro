import { describe, expect, test } from "bun:test";

import {
	mobileNavigation,
	type NavGroup,
	type NavItem,
	type NavSection,
	navigationLayout,
} from "../src/lib/navigation";

const catalog: NavGroup = {
	id: "catalogo-estoque",
	label: "Catálogo e estoque",
};
const management: NavGroup = { id: "gestao", label: "Gestão" };
const groups = [catalog, management];

function item(
	id: string,
	options: Partial<Pick<NavItem, "group" | "mobile" | "tier">> = {}
): NavItem {
	return {
		href: `/${id}`,
		id,
		label: id,
		mobile: options.mobile ?? false,
		tier: options.tier ?? "primary",
		...(options.group ? { group: options.group } : {}),
	};
}

const items = [
	item("hoje", { mobile: true }),
	item("os", { mobile: true }),
	item("producao", { tier: "secondary" }),
	item("vendas", { mobile: true }),
	item("catalogo", { group: "catalogo-estoque" }),
	item("financas", { group: "gestao" }),
	item("estoque", { group: "catalogo-estoque" }),
	item("configuracoes", { group: "gestao" }),
];

const ids = (list: readonly NavItem[]) => list.map((entry) => entry.id);
const sectionIds = (sections: readonly NavSection[]) =>
	sections.map((section) => [section.group?.id ?? null, ids(section.items)]);

describe("navigationLayout", () => {
	test("xl mostra primários e secundários soltos e um menu por grupo", () => {
		const layout = navigationLayout(items, groups, "xl");
		expect(ids(layout.inline)).toEqual(["hoje", "os", "producao", "vendas"]);
		expect(sectionIds(layout.menus)).toEqual([
			["catalogo-estoque", ["catalogo", "estoque"]],
			["gestao", ["financas", "configuracoes"]],
		]);
		expect(layout.overflow).toEqual([]);
	});

	test("md deixa só os primários soltos e junta o resto em Mais por grupo", () => {
		const layout = navigationLayout(items, groups, "md");
		expect(ids(layout.inline)).toEqual(["hoje", "os", "vendas"]);
		expect(layout.menus).toEqual([]);
		expect(sectionIds(layout.overflow)).toEqual([
			[null, ["producao"]],
			["catalogo-estoque", ["catalogo", "estoque"]],
			["gestao", ["financas", "configuracoes"]],
		]);
	});

	test("cada destino aparece exatamente uma vez em toda largura", () => {
		for (const viewport of ["md", "xl"] as const) {
			const layout = navigationLayout(items, groups, viewport);
			const all = [
				...ids(layout.inline),
				...layout.menus.flatMap((section) => ids(section.items)),
				...layout.overflow.flatMap((section) => ids(section.items)),
			];
			expect(all.sort()).toEqual(ids(items).sort());
		}
	});

	test("grupo sem destino não vira menu", () => {
		const layout = navigationLayout(
			items.filter((entry) => entry.group !== "gestao"),
			groups,
			"xl"
		);
		expect(layout.menus.map((section) => section.group?.id)).toEqual([
			"catalogo-estoque",
		]);
	});
});

describe("mobileNavigation", () => {
	test("barra com os marcados e Mais com soltos primeiro e depois os grupos", () => {
		const { bar, more } = mobileNavigation(items, groups);
		expect(ids(bar)).toEqual(["hoje", "os", "vendas"]);
		expect(sectionIds(more)).toEqual([
			[null, ["producao"]],
			["catalogo-estoque", ["catalogo", "estoque"]],
			["gestao", ["financas", "configuracoes"]],
		]);
	});
});
