import { expect, test } from "bun:test";

import { suggestPrice } from "./pricing";

test("margem de 40% sobre venda torna custo de R$60 em preço de R$100", () => {
	expect(suggestPrice(6000n, 4000)).toBe(10000n);
});

test("arredonda preço mínimo para cima ao centavo", () => {
	expect(suggestPrice(1n, 3333)).toBe(2n);
});

test("rejeita meta de 100%", () => {
	expect(() => suggestPrice(100n, 10_000)).toThrow();
});
