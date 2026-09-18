import { describe, expect, test } from "bun:test";

import {
	accountFormErrors,
	accountKindLabel,
	accountKindOptions,
	accountOpeningErrors,
	accountOpeningFields,
	accountTransferErrors,
	accountTransferFields,
	financialMovementKindLabel,
	isOverdue,
	obligationStatusLabel,
	signedMoney,
} from "../src/lib/finance";
import { sectionTabs } from "../src/lib/section-tabs";

describe("sectionTabs de finanças", () => {
	test("Finanças tem Contas e A pagar", () => {
		expect(sectionTabs.financas.map((tab) => [tab.href, tab.label])).toEqual([
			["/financas/contas", "Contas"],
			["/financas/a-pagar", "A pagar"],
		]);
	});
});

describe("rótulos", () => {
	test("tipos de conta na ordem do domínio", () => {
		expect(accountKindOptions).toEqual([
			{ label: "Dinheiro", value: "cash" },
			{ label: "Banco", value: "bank" },
			{ label: "Pix", value: "pix" },
			{ label: "Outra", value: "other" },
		]);
		expect(accountKindLabel("pix")).toBe("Pix");
	});

	test("tipos de movimento e estados da obrigação", () => {
		expect(financialMovementKindLabel("obligationPayment")).toBe(
			"Pagamento de compra"
		);
		expect(financialMovementKindLabel("transferOut")).toBe(
			"Transferência (saída)"
		);
		expect(obligationStatusLabel("open")).toBe("A pagar");
		expect(obligationStatusLabel("paid")).toBe("Paga");
		expect(obligationStatusLabel("cancelled")).toBe("Cancelada");
	});

	test("valor com sinal separa o sinal dos centavos", () => {
		expect(signedMoney("-1250")).toBe("-R$ 12,50");
		expect(signedMoney("1250")).toBe("+R$ 12,50");
		expect(signedMoney("0")).toBe("R$ 0,00");
	});
});

describe("formulário de conta", () => {
	test("pede nome e limita o texto", () => {
		expect(accountFormErrors({ kind: "cash", name: " ", notes: "" })).toEqual({
			name: "Informe o nome da conta",
		});
		expect(
			accountFormErrors({ kind: "cash", name: "a".repeat(61), notes: "" }).name
		).toBe("Use até 60 caracteres");
		expect(
			accountFormErrors({
				kind: "cash",
				name: "Caixa",
				notes: "a".repeat(2001),
			}).notes
		).toBe("Use até 2000 caracteres");
		expect(
			accountFormErrors({ kind: "bank", name: "Banco", notes: "" })
		).toEqual({});
	});
});

describe("saldo de abertura da conta", () => {
	test("aceita saldo positivo ou negativo com vírgula", () => {
		expect(
			accountOpeningFields({
				amount: "1250,50",
				direction: "in",
				occurredOn: "2026-09-17",
				reason: "",
			})
		).toEqual({
			amountCents: "125050",
			kind: "opening",
			occurredOn: "2026-09-17",
			reason: null,
		});
		expect(
			accountOpeningFields({
				amount: "80",
				direction: "out",
				occurredOn: "2026-09-17",
				reason: " Cheque especial ",
			})
		).toMatchObject({ amountCents: "-8000", reason: "Cheque especial" });
	});

	test("recusa valor vazio, zero, mal escrito e data inválida", () => {
		const base = {
			amount: "10",
			direction: "in" as const,
			occurredOn: "2026-09-17",
			reason: "",
		};
		expect(accountOpeningErrors({ ...base, amount: "" }).amount).toBe(
			"Informe um valor maior que zero"
		);
		expect(accountOpeningErrors({ ...base, amount: "0,00" }).amount).toBe(
			"Informe um valor maior que zero"
		);
		expect(accountOpeningErrors({ ...base, amount: "12.5.0" }).amount).toBe(
			"Use só número, com vírgula e até 2 casas"
		);
		expect(accountOpeningErrors({ ...base, occurredOn: "" }).occurredOn).toBe(
			"Data inválida"
		);
		expect(accountOpeningErrors(base)).toEqual({});
	});
});

describe("transferência entre contas", () => {
	const base = {
		amount: "40",
		occurredOn: "2026-09-17",
		reason: "",
		toAccountId: "conta-2",
	};

	test("pede destino diferente da origem", () => {
		expect(
			accountTransferErrors({ ...base, toAccountId: "" }, "conta-1")
		).toEqual({ toAccountId: "Escolha a conta de destino" });
		expect(
			accountTransferErrors({ ...base, toAccountId: "conta-1" }, "conta-1")
		).toEqual({ toAccountId: "Escolha uma conta diferente da origem" });
		expect(accountTransferErrors(base, "conta-1")).toEqual({});
	});

	test("monta o comando com o valor em centavos", () => {
		expect(accountTransferFields(base, "conta-1")).toEqual({
			amountCents: "4000",
			fromAccountId: "conta-1",
			occurredOn: "2026-09-17",
			reason: null,
			toAccountId: "conta-2",
		});
	});
});

describe("vencimento", () => {
	test("só obrigação aberta com vencimento passado está vencida", () => {
		expect(isOverdue("2026-09-16", "2026-09-17", "open")).toBe(true);
		expect(isOverdue("2026-09-17", "2026-09-17", "open")).toBe(false);
		expect(isOverdue("2026-09-16", "2026-09-17", "paid")).toBe(false);
		expect(isOverdue("2026-09-16", "2026-09-17", "cancelled")).toBe(false);
	});
});
