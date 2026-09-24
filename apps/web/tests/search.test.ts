import { describe, expect, test } from "bun:test";

import {
	type ClientHitView,
	clientDetail,
	emptyHint,
	groupOfParam,
	isEmptyResult,
	isSearchShortcut,
	type MaterialVariantHitView,
	materialVariantLabel,
	moreVariants,
	type ParentHitView,
	paletteGroups,
	parentDetail,
	productVariantLabel,
	profileDetail,
	type QuoteHitView,
	quoteDetail,
	type SearchView,
	type ServiceOrderHitView,
	type ShortcutEvent,
	searchReady,
	searchStatus,
	searchTabs,
	seeAllLabel,
	seeGroupLabel,
	serviceDetail,
	serviceOrderDetail,
} from "../src/lib/search";
import { globalSearchParams } from "../src/search/search-params";

const key = (overrides: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
	altKey: false,
	ctrlKey: true,
	isComposing: false,
	key: "k",
	metaKey: false,
	shiftKey: false,
	...overrides,
});

const none = { items: [], total: 0 };
const nothingFound: SearchView = {
	clients: none,
	materials: none,
	products: none,
	profiles: none,
	quotes: none,
	serviceOrders: none,
	services: none,
};
const quoteHit = (overrides: Partial<QuoteHitView> = {}): QuoteHitView => ({
	approved: false,
	archived: false,
	clientName: "Maria Beatriz Alencar",
	code: "ORC-2026-PC-0001",
	id: "orc1",
	refused: false,
	revisionNumber: 1,
	totalCents: "88200",
	validUntil: "2026-10-09",
	...overrides,
});
const orderHit = (
	overrides: Partial<ServiceOrderHitView> = {}
): ServiceOrderHitView => ({
	clientName: "Maria Beatriz Alencar",
	code: "OS-2026-PC-0002",
	dueOn: "2026-10-12",
	id: "os2",
	itemCount: 3,
	totalCents: "124400",
	...overrides,
});
const cru: MaterialVariantHitView = {
	archived: false,
	baseUnit: "m",
	code: "LIN-CRU",
	displayPrecision: 2,
	id: "cru",
	name: "Cru",
	quantityMicros: "31000000",
};
const linho: ParentHitView<MaterialVariantHitView> = {
	archived: false,
	category: "Tecidos",
	id: "linho",
	matchedCount: 1,
	name: "Linho",
	variantCount: 2,
	variants: [cru],
};
const client = (id: string): ClientHitView => ({
	archived: false,
	email: null,
	id,
	kind: "person",
	name: `Cliente ${id}`,
	phone: null,
	secondaryPhone: null,
});
const bia = {
	archived: false,
	clientId: "ana",
	clientName: "Ana Souza",
	id: "bia",
	name: "Bia",
};
const found: SearchView = {
	...nothingFound,
	clients: {
		items: ["a", "b", "c", "d", "e"].map(client),
		total: 6,
	},
	materials: { items: [linho], total: 1 },
	profiles: { items: [bia], total: 1 },
	quotes: {
		items: [quoteHit(), quoteHit({ code: "ORC-2026-PC-0002", id: "orc2" })],
		total: 2,
	},
	serviceOrders: {
		items: [orderHit(), orderHit({ code: "OS-2026-PC-0003", id: "os3" })],
		total: 2,
	},
};

describe("atalho da busca", () => {
	test("aceita Ctrl+K e Cmd+K, com K maiúsculo inclusive", () => {
		expect(isSearchShortcut(key())).toBe(true);
		expect(isSearchShortcut(key({ ctrlKey: false, metaKey: true }))).toBe(true);
		expect(isSearchShortcut(key({ key: "K" }))).toBe(true);
	});

	test("recusa Shift, Alt, composição, outra tecla e K sem modificador", () => {
		expect(isSearchShortcut(key({ shiftKey: true }))).toBe(false);
		expect(isSearchShortcut(key({ altKey: true }))).toBe(false);
		expect(isSearchShortcut(key({ isComposing: true }))).toBe(false);
		expect(isSearchShortcut(key({ key: "j" }))).toBe(false);
		expect(isSearchShortcut(key({ ctrlKey: false }))).toBe(false);
	});
});

describe("busca pronta", () => {
	test("começa com 2 caracteres depois de tirar os espaços", () => {
		expect(searchReady("an")).toBe(true);
		expect(searchReady(" a ")).toBe(false);
		expect(searchReady("")).toBe(false);
	});
});

describe("linhas do resultado", () => {
	test("cliente mostra o telefone, senão o secundário, senão o e-mail, senão sem contato", () => {
		expect(
			clientDetail({
				email: "ana@exemplo.com",
				phone: "11987654321",
				secondaryPhone: "81998887766",
			})
		).toBe("(11) 98765-4321");
		expect(
			clientDetail({
				email: "ana@exemplo.com",
				phone: null,
				secondaryPhone: "81998887766",
			})
		).toBe("(81) 99888-7766");
		expect(
			clientDetail({
				email: "ana@exemplo.com",
				phone: null,
				secondaryPhone: null,
			})
		).toBe("ana@exemplo.com");
		expect(
			clientDetail({ email: null, phone: null, secondaryPhone: null })
		).toBe("Sem contato");
	});

	test("perfil diz de quem é", () => {
		expect(profileDetail({ clientName: "Ana Souza" })).toBe(
			"Perfil de Ana Souza"
		);
	});

	test("pai mostra a categoria e as variantes ativas", () => {
		expect(parentDetail("Tecidos", 3)).toBe("Tecidos · 3 variantes");
		expect(parentDetail(null, 1)).toBe("Sem categoria · 1 variante");
		expect(parentDetail("Vestidos", 0)).toBe("Vestidos · Sem variantes");
	});

	test("variante de produto com código e preço, e de material com código e saldo", () => {
		expect(
			productVariantLabel({
				archived: false,
				code: "VM-M",
				id: "m",
				name: "M Azul marinho",
				priceCents: "28990",
			})
		).toBe("M Azul marinho · VM-M · R$ 289,90");
		expect(
			productVariantLabel({
				archived: true,
				code: null,
				id: "p",
				name: "P",
				priceCents: "0",
			})
		).toBe("P · R$ 0,00 · arquivada");
		expect(materialVariantLabel(cru)).toBe("Cru · LIN-CRU · 31,00 m");
		expect(
			materialVariantLabel({
				...cru,
				baseUnit: "un",
				code: null,
				displayPrecision: 0,
				name: "Botão",
				quantityMicros: "-2000000",
			})
		).toBe("Botão · -2 un");
	});

	test("conta as variantes além das mostradas", () => {
		expect(moreVariants(5, 3)).toBe("e mais 2 variantes");
		expect(moreVariants(4, 3)).toBe("e mais 1 variante");
		expect(moreVariants(3, 3)).toBeNull();
	});

	test("orçamento mostra o cliente, o estado do dia e o total", () => {
		const today = "2026-09-24";
		expect(quoteDetail(quoteHit(), today)).toBe(
			"Maria Beatriz Alencar · emitido · R$ 882,00"
		);
		expect(quoteDetail(quoteHit({ validUntil: "2026-09-20" }), today)).toBe(
			"Maria Beatriz Alencar · vencido · R$ 882,00"
		);
		expect(quoteDetail(quoteHit({ refused: true }), today)).toBe(
			"Maria Beatriz Alencar · recusado · R$ 882,00"
		);
		expect(
			quoteDetail(quoteHit({ revisionNumber: null, validUntil: null }), today)
		).toBe("Maria Beatriz Alencar · rascunho · R$ 882,00");
		expect(
			quoteDetail(
				quoteHit({ approved: true, refused: true, validUntil: "2026-09-20" }),
				today
			)
		).toBe("Maria Beatriz Alencar · aprovado · R$ 882,00");
	});

	test("OS mostra o cliente, os subitens, o prazo e o total a receber", () => {
		expect(serviceOrderDetail(orderHit())).toBe(
			"Maria Beatriz Alencar · 3 subitens · prazo 12/10/2026 · R$ 1.244,00"
		);
		expect(
			serviceOrderDetail(
				orderHit({ dueOn: null, itemCount: 1, totalCents: "0" })
			)
		).toBe(
			"Maria Beatriz Alencar · 1 subitem · prazo a combinar · sem cobrança"
		);
	});

	test("serviço mostra a categoria e o preço praticado", () => {
		expect(serviceDetail({ category: "Ajustes", priceCents: "3500" })).toBe(
			"Ajustes · R$ 35,00"
		);
		expect(serviceDetail({ category: null, priceCents: "3500" })).toBe(
			"Sem categoria · R$ 35,00"
		);
	});
});

describe("diálogo de busca", () => {
	test("mostra até 3 por grupo com a contagem e termina em ver todos", () => {
		const groups = paletteGroups(found);
		expect(
			groups.map((group) => [
				group.id,
				group.label,
				group.items.map((option) => option.id),
			])
		).toEqual([
			["clients", "Clientes · 6", ["clients:a", "clients:b", "clients:c"]],
			["profiles", "Perfis · 1", ["profiles:bia"]],
			["quotes", "Orçamentos · 2", ["quotes:orc1", "quotes:orc2"]],
			["serviceOrders", "OS · 2", ["serviceOrders:os2", "serviceOrders:os3"]],
			["materials", "Materiais · 1", ["materials:linho"]],
			["more", null, ["all"]],
		]);
		expect(groups.at(-1)?.items[0]?.label).toBe("Ver todos os 12 resultados");
		expect(groups[3]?.items.map((option) => option.label)).toEqual([
			"OS-2026-PC-0002",
			"OS-2026-PC-0003",
		]);
	});

	test("sem resultado, oferece buscar nos arquivados", () => {
		expect(
			paletteGroups(nothingFound).map((group) =>
				group.items.map((option) => [option.kind, option.label])
			)
		).toEqual([[["archived", "Buscar também nos arquivados"]]]);
	});

	test("o rótulo de ver todos fica no singular com um resultado", () => {
		expect(seeAllLabel(1)).toBe("Ver o resultado na página de busca");
		expect(seeAllLabel(14)).toBe("Ver todos os 14 resultados");
	});
});

describe("abas da página", () => {
	test("tudo com a soma e uma aba por grupo com resultado", () => {
		expect(searchTabs(found)).toEqual([
			{ count: 12, group: null, id: "tudo", label: "Tudo" },
			{ count: 6, group: "clients", id: "clientes", label: "Clientes" },
			{ count: 1, group: "profiles", id: "perfis", label: "Perfis" },
			{ count: 2, group: "quotes", id: "orcamentos", label: "Orçamentos" },
			{ count: 2, group: "serviceOrders", id: "os", label: "OS" },
			{ count: 1, group: "materials", id: "materiais", label: "Materiais" },
		]);
		expect(searchTabs(nothingFound)).toEqual([
			{ count: 0, group: null, id: "tudo", label: "Tudo" },
		]);
	});

	test("o parâmetro da URL vira o grupo da API e o resto vira nulo", () => {
		expect(groupOfParam("materiais")).toBe("materials");
		expect(groupOfParam("servicos")).toBe("services");
		expect(groupOfParam("orcamentos")).toBe("quotes");
		expect(groupOfParam("os")).toBe("serviceOrders");
		expect(groupOfParam("tudo")).toBeNull();
		expect(groupOfParam(undefined)).toBeNull();
	});

	test("o atalho da aba diz quantos o grupo tem", () => {
		expect(seeGroupLabel("clients", 6)).toBe("Ver os 6 clientes");
		expect(seeGroupLabel("services", 12)).toBe("Ver os 12 serviços");
		expect(seeGroupLabel("serviceOrders", 3)).toBe("Ver as 3 OS");
	});
});

describe("status e vazio", () => {
	test("anuncia os totais por grupo na ordem da tela", () => {
		expect(searchStatus(found, "linho", false)).toBe(
			"6 clientes, 1 perfil, 2 orçamentos, 2 OS e 1 material para linho"
		);
		expect(
			searchStatus(
				{ ...nothingFound, serviceOrders: { items: [orderHit()], total: 1 } },
				"os",
				false
			)
		).toBe("1 OS para os");
		expect(searchStatus(nothingFound, "zzz", false)).toBe(
			"Nada encontrado para zzz"
		);
		expect(
			searchStatus(
				{ ...nothingFound, quotes: { items: [quoteHit()], total: 1 } },
				"orc",
				false
			)
		).toBe("1 orçamento para orc");
	});

	test("em andamento, anuncia a busca nova e nunca o resultado velho", () => {
		expect(searchStatus(found, "marta", true)).toBe("Buscando marta");
		expect(searchStatus(undefined, "marta", false)).toBe("");
	});

	test("vazio pelos totais", () => {
		expect(isEmptyResult(nothingFound)).toBe(true);
		expect(isEmptyResult(found)).toBe(false);
	});

	test("a dica só sugere incluir arquivados com a caixa desmarcada", () => {
		expect(emptyHint(false)).toContain("Incluir arquivados");
		expect(emptyHint(true)).not.toContain("Incluir arquivados");
	});
});

describe("parâmetros da página", () => {
	test("aceitam busca até o teto, arquivados=1 e o grupo conhecido", () => {
		expect(
			globalSearchParams.parse({
				arquivados: 1,
				busca: "linho",
				grupo: "materiais",
			})
		).toEqual({ arquivados: 1, busca: "linho", grupo: "materiais" });
		expect(globalSearchParams.parse({ grupo: "os" })).toEqual({
			arquivados: undefined,
			busca: undefined,
			grupo: "os",
		});
		expect(
			globalSearchParams.parse({
				arquivados: 2,
				busca: "x".repeat(101),
				grupo: "fornecedores",
			})
		).toEqual({ arquivados: undefined, busca: undefined, grupo: undefined });
	});
});
