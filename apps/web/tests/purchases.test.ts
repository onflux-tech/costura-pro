import { describe, expect, test } from "bun:test";

import {
	defaultPackaging,
	draftSummary,
	itemDraftErrors,
	type PurchaseFormValues,
	type PurchaseItemDraft,
	packagingSummary,
	plusDays,
	purchaseFields,
	purchaseFormErrors,
	purchasePreview,
	purchaseProblemMessage,
	purchaseStatusLabel,
	supplierFields,
	supplierFormErrors,
	supplierFormValues,
	supplierPatch,
	supplierSelectItems,
	unitCostLabel,
	type VariantOptionView,
} from "../src/lib/purchases";
import { sectionTabs } from "../src/lib/section-tabs";
import { movementKindLabel } from "../src/lib/stock";

const fabric: VariantOptionView = {
	baseUnit: "m",
	code: "GR-AZ",
	displayPrecision: 2,
	id: "variante-tecido",
	materialId: "material-1",
	materialName: "Gorgurão",
	name: "Azul marinho",
	packaging: { label: "Rolo 50 m", quantityMicros: "50000000" },
	referenceCostCents: "2550",
	tracksLots: false,
};

const thread: VariantOptionView = {
	...fabric,
	baseUnit: "un",
	displayPrecision: 0,
	id: "variante-linha",
	materialName: "Linha",
	name: "Branca",
	packaging: null,
};

function draft(overrides: Partial<PurchaseItemDraft> = {}): PurchaseItemDraft {
	return {
		key: "item-1",
		locationId: "local-1",
		lotId: null,
		movementId: "movimento-1",
		packageCount: "3",
		packagingLabel: "Rolo 50 m",
		packagingQuantity: "50",
		unitPrice: "120,00",
		variant: fabric,
		...overrides,
	};
}

function form(overrides: Partial<PurchaseFormValues> = {}): PurchaseFormValues {
	return {
		accountId: "conta-1",
		discount: "20,00",
		dueOn: "2026-10-17",
		freight: "15,00",
		items: [
			draft(),
			draft({
				key: "item-2",
				movementId: "movimento-2",
				packageCount: "10",
				packagingLabel: "un",
				packagingQuantity: "1",
				unitPrice: "8,50",
				variant: thread,
			}),
		],
		notes: "",
		occurredOn: "2026-09-17",
		paymentKind: "now",
		reference: "NF 4521",
		supplierId: "fornecedor-1",
		...overrides,
	};
}

describe("sectionTabs de compras", () => {
	test("Compras tem a lista e os fornecedores", () => {
		expect(sectionTabs.compras.map((tab) => [tab.href, tab.label])).toEqual([
			["/compras/recebidas", "Compras"],
			["/compras/fornecedores", "Fornecedores"],
		]);
	});

	test("o movimento de compra tem rótulo no estoque", () => {
		expect(movementKindLabel("purchase")).toBe("Compra");
	});
});

describe("embalagem padrão", () => {
	test("copia a embalagem da variante na unidade base", () => {
		expect(defaultPackaging(fabric)).toEqual({
			label: "Rolo 50 m",
			quantity: "50",
		});
	});

	test("sem embalagem, a embalagem é a própria unidade base", () => {
		expect(defaultPackaging(thread)).toEqual({ label: "un", quantity: "1" });
	});
});

describe("item da compra", () => {
	test("aceita um item completo", () => {
		expect(itemDraftErrors(draft())).toEqual({});
	});

	test("pede local, lote na variante por lote e valores válidos", () => {
		expect(
			itemDraftErrors(
				draft({
					locationId: "",
					packageCount: "0",
					packagingLabel: " ",
					packagingQuantity: "abc",
					unitPrice: "12.5.0",
					variant: { ...fabric, tracksLots: true },
				})
			)
		).toEqual({
			locationId: "Escolha o local",
			lotId: "Escolha o lote",
			packageCount: "Informe uma quantidade maior que zero",
			packagingLabel: "Informe a embalagem",
			packagingQuantity: "Use só número, com vírgula",
			unitPrice: "Use só número, com vírgula e até 2 casas",
		});
	});

	test("aceita preço zero, que é brinde, e recusa preço vazio", () => {
		expect(itemDraftErrors(draft({ unitPrice: "0" }))).toEqual({});
		expect(itemDraftErrors(draft({ unitPrice: "" })).unitPrice).toBe(
			"Informe o preço da embalagem"
		);
	});
});

describe("prévia da compra", () => {
	test("rateia frete e desconto como o servidor (CA-03)", () => {
		const preview = purchasePreview(form());
		expect(preview?.ok).toBe(true);
		if (!preview?.ok) {
			return;
		}
		expect(preview.totals.lines.map((line) => line.valueCents)).toEqual([
			35_596n,
			8404n,
		]);
		expect(preview.totals.totalCents).toBe(44_000n);
	});

	test("não calcula enquanto algum valor está inválido", () => {
		expect(purchasePreview(form({ freight: "abc" }))).toBeNull();
		expect(
			purchasePreview(form({ items: [draft({ unitPrice: "" })] }))
		).toBeNull();
		expect(purchasePreview(form({ items: [] }))).toBeNull();
	});

	test("mostra o custo por unidade base", () => {
		expect(unitCostLabel(35_596n, 150_000_000n, "m")).toBe("R$ 2,37 por m");
		expect(unitCostLabel(8404n, 10_000_000n, "un")).toBe("R$ 8,40 por un");
	});
});

describe("formulário da compra", () => {
	test("aceita a compra completa", () => {
		expect(purchaseFormErrors(form(), "2026-09-17")).toEqual({});
	});

	test("pede fornecedor, itens, conta ou vencimento e data válida", () => {
		expect(
			purchaseFormErrors(
				form({ accountId: "", items: [], supplierId: "" }),
				"2026-09-17"
			)
		).toEqual({
			accountId: "Escolha a conta que pagou",
			items: "Inclua pelo menos um item",
			supplierId: "Escolha o fornecedor",
		});
		expect(
			purchaseFormErrors(
				form({ dueOn: "2026-09-10", paymentKind: "later" }),
				"2026-09-17"
			)
		).toEqual({ dueOn: "O vencimento não pode ser antes da compra" });
		expect(
			purchaseFormErrors(form({ occurredOn: "2026-09-18" }), "2026-09-17")
		).toEqual({ occurredOn: "A data da compra não pode ser futura" });
	});

	test("explica o problema dos valores", () => {
		expect(
			purchaseFormErrors(
				form({ discount: "445,00", freight: "0" }),
				"2026-09-17"
			)
		).toEqual({ totals: purchaseProblemMessage("nonPositiveTotal") });
		expect(purchaseProblemMessage("allocationWithoutGross")).toBe(
			"Frete e desconto precisam de algum item com preço"
		);
	});

	test("recusa item com erro sem abrir o item", () => {
		expect(
			purchaseFormErrors(
				form({ items: [draft({ locationId: "" })] }),
				"2026-09-17"
			)
		).toEqual({ items: "Corrija os itens marcados" });
	});
});

describe("comando da compra", () => {
	test("paga agora leva conta e o id do pagamento", () => {
		expect(
			purchaseFields(form(), {
				obligationId: "obrigacao-1",
				paymentMovementId: "pagamento-1",
			})
		).toEqual({
			discountCents: "2000",
			freightCents: "1500",
			items: [
				{
					locationId: "local-1",
					lotId: null,
					movementId: "movimento-1",
					packageCountMicros: "3000000",
					packagingLabel: "Rolo 50 m",
					packagingQuantityMicros: "50000000",
					unitPriceCents: "12000",
					variantId: "variante-tecido",
				},
				{
					locationId: "local-1",
					lotId: null,
					movementId: "movimento-2",
					packageCountMicros: "10000000",
					packagingLabel: "un",
					packagingQuantityMicros: "1000000",
					unitPriceCents: "850",
					variantId: "variante-linha",
				},
			],
			notes: null,
			obligationId: "obrigacao-1",
			occurredOn: "2026-09-17",
			payment: {
				accountId: "conta-1",
				kind: "now",
				movementId: "pagamento-1",
			},
			reference: "NF 4521",
			supplierId: "fornecedor-1",
		});
	});

	test("a pagar leva só o vencimento", () => {
		expect(
			purchaseFields(form({ paymentKind: "later", reference: " " }), {
				obligationId: "obrigacao-1",
				paymentMovementId: "pagamento-1",
			})
		).toMatchObject({
			payment: { dueOn: "2026-10-17", kind: "later" },
			reference: null,
		});
	});
});

describe("apoio", () => {
	test("soma dias a uma data local", () => {
		expect(plusDays("2026-09-17", 30)).toBe("2026-10-17");
		expect(plusDays("2026-12-15", 30)).toBe("2027-01-14");
	});

	test("rótulo do estado da compra", () => {
		expect(purchaseStatusLabel("paid")).toBe("Paga");
		expect(purchaseStatusLabel("open")).toBe("A pagar");
		expect(purchaseStatusLabel("reversed")).toBe("Estornada");
	});
});

describe("fornecedor", () => {
	const supplier = {
		archivedAt: null,
		createdAt: "2026-09-17T12:00:00.000Z",
		email: "vendas@tecidos.com",
		id: "fornecedor-1",
		name: "Tecidos São José",
		notes: null,
		phone: "11987654321",
		updatedAt: "2026-09-17T12:00:00.000Z",
		version: 1,
	};

	test("abre o formulário com o telefone formatado", () => {
		expect(supplierFormValues(supplier)).toEqual({
			email: "vendas@tecidos.com",
			name: "Tecidos São José",
			notes: "",
			phone: "(11) 98765-4321",
		});
		expect(supplierFormValues(null)).toEqual({
			email: "",
			name: "",
			notes: "",
			phone: "",
		});
	});

	test("pede nome e recusa telefone e e-mail inválidos", () => {
		expect(
			supplierFormErrors({
				email: "sem-arroba",
				name: " ",
				notes: "",
				phone: "1234",
			})
		).toEqual({
			email: "E-mail inválido",
			name: "Informe o nome do fornecedor",
			phone: "Telefone com DDD, como (81) 99815-4402",
		});
		expect(supplierFormErrors(supplierFormValues(supplier))).toEqual({});
	});

	test("manda só o que mudou, com o telefone em dígitos", () => {
		expect(
			supplierPatch(supplier, {
				...supplierFormValues(supplier),
				notes: "Entrega às terças",
				phone: "(11) 98765-4321",
			})
		).toEqual({ notes: "Entrega às terças" });
		expect(
			supplierFields({ email: " ", name: " Aviamentos ", notes: "", phone: "" })
		).toEqual({ email: null, name: "Aviamentos", notes: null, phone: null });
	});
});

describe("resumo da embalagem", () => {
	test("embalagem própria mostra o conteúdo", () => {
		expect(
			packagingSummary({
				baseUnit: "m",
				displayPrecision: 2,
				packageCountMicros: 3_000_000n,
				packagingLabel: "Rolo 50 m",
				packagingQuantityMicros: 50_000_000n,
			})
		).toBe("3 × Rolo 50 m (50,00 m)");
	});

	test("embalagem igual à unidade base vira só a quantidade", () => {
		expect(
			packagingSummary({
				baseUnit: "un",
				displayPrecision: 0,
				packageCountMicros: 10_000_000n,
				packagingLabel: "un",
				packagingQuantityMicros: 1_000_000n,
			})
		).toBe("10 un");
		expect(
			draftSummary(
				draft({
					packageCount: "2,5",
					packagingLabel: "m",
					packagingQuantity: "1",
				})
			)
		).toBe("2,5 m");
	});
});

describe("opções de fornecedor", () => {
	const options = [
		{
			archivedAt: "2026-09-17T12:00:00.000Z",
			id: "arquivado",
			name: "Aviamentos",
		},
		{ archivedAt: null, id: "ativo", name: "Tecidos" },
	];

	test("a compra oferece só os ativos, mais o escolhido se foi arquivado", () => {
		expect(supplierSelectItems(options, "")).toEqual([
			{ label: "Tecidos", value: "ativo" },
		]);
		expect(supplierSelectItems(options, "arquivado")).toEqual([
			{ label: "Aviamentos (arquivado)", value: "arquivado" },
			{ label: "Tecidos", value: "ativo" },
		]);
	});
});
