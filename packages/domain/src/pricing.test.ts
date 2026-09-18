import { expect, test } from "bun:test";

import {
	formatMarginInput,
	formatMarginPercent,
	parseMarginPercent,
	pricingOf,
	suggestPrice,
} from "./pricing";

test("margem de 40% sobre venda torna custo de R$60 em preço de R$100", () => {
	expect(suggestPrice(6000n, 4000)).toBe(10000n);
});

test("arredonda preço mínimo para cima ao centavo", () => {
	expect(suggestPrice(1n, 3333)).toBe(2n);
});

test("rejeita meta de 100%", () => {
	expect(() => suggestPrice(100n, 10_000)).toThrow();
});

test("meta em percentual vira pontos-base com até duas casas", () => {
	expect(parseMarginPercent("40")).toBe(4000);
	expect(parseMarginPercent("37,5")).toBe(3750);
	expect(parseMarginPercent(" 12.34 ")).toBe(1234);
	expect(parseMarginPercent("99,99")).toBe(9999);
	expect(parseMarginPercent("40%")).toBe(4000);
	expect(parseMarginPercent("0")).toBe(0);
	for (const invalid of ["", "100", "-1", "1,234", "abc", "40,"]) {
		expect(parseMarginPercent(invalid)).toBeNull();
	}
});

test("pontos-base viram percentual sem zeros à direita", () => {
	expect(formatMarginPercent(4000)).toBe("40%");
	expect(formatMarginPercent(3750)).toBe("37,5%");
	expect(formatMarginPercent(1234)).toBe("12,34%");
	expect(formatMarginPercent(5)).toBe("0,05%");
	expect(formatMarginPercent(-2000)).toBe("-20%");
	expect(formatMarginPercent(0)).toBe("0%");
	expect(formatMarginInput(3750)).toBe("37,5");
});

test("preço no sugerido fica na meta e um centavo abaixo fica abaixo", () => {
	expect(
		pricingOf({
			costCents: 6000n,
			priceCents: 10_000n,
			targetMarginBasisPoints: 4000,
		})
	).toEqual({
		belowCost: false,
		belowTarget: false,
		marginBasisPoints: 4000,
		suggestedCents: 10_000n,
	});
	expect(
		pricingOf({
			costCents: 6000n,
			priceCents: 9999n,
			targetMarginBasisPoints: 4000,
		})
	).toEqual({
		belowCost: false,
		belowTarget: true,
		marginBasisPoints: 3999,
		suggestedCents: 10_000n,
	});
});

test("margem do preço arredonda para baixo, inclusive negativa", () => {
	const margin = (costCents: bigint, priceCents: bigint) =>
		pricingOf({ costCents, priceCents, targetMarginBasisPoints: 0 })
			.marginBasisPoints;
	expect(margin(1n, 3n)).toBe(6666);
	expect(margin(3n, 2n)).toBe(-5000);
	expect(margin(5n, 3n)).toBe(-6667);
	expect(margin(19_999n, 20_000n)).toBe(0);
	expect(margin(20_001n, 20_000n)).toBe(-1);
	expect(
		pricingOf({
			costCents: 6000n,
			priceCents: 5000n,
			targetMarginBasisPoints: 4000,
		})
	).toEqual({
		belowCost: true,
		belowTarget: true,
		marginBasisPoints: -2000,
		suggestedCents: 10_000n,
	});
});

test("preço abaixo da meta nunca mostra a margem da meta", () => {
	expect(
		pricingOf({
			costCents: 60_000n,
			priceCents: 99_999n,
			targetMarginBasisPoints: 4000,
		})
	).toMatchObject({ belowTarget: true, marginBasisPoints: 3999 });
});

test("preço zero não tem margem", () => {
	expect(
		pricingOf({
			costCents: 500n,
			priceCents: 0n,
			targetMarginBasisPoints: 4000,
		})
	).toEqual({
		belowCost: true,
		belowTarget: true,
		marginBasisPoints: null,
		suggestedCents: 834n,
	});
	expect(
		pricingOf({ costCents: 0n, priceCents: 0n, targetMarginBasisPoints: 4000 })
	).toEqual({
		belowCost: false,
		belowTarget: false,
		marginBasisPoints: null,
		suggestedCents: 0n,
	});
});
