import { describe, expect, test } from "bun:test";

import { supplierLimits, supplierSearchKey } from "./supplier";

describe("supplierSearchKey", () => {
	test("junta nome, e-mail e telefone sem acento e em minúsculas", () => {
		expect(
			supplierSearchKey({
				email: "Loja@Tecidos.com",
				name: "Tecidos  São José",
				phone: "11987654321",
			})
		).toBe("tecidos sao jose loja@tecidos.com 11987654321");
	});

	test("deixa de fora o que está vazio", () => {
		expect(
			supplierSearchKey({ email: null, name: "Aviamentos Ltda", phone: null })
		).toBe("aviamentos ltda");
	});
});

describe("supplierLimits", () => {
	test("segue os limites do cadastro de cliente", () => {
		expect(supplierLimits).toEqual({
			email: 254,
			name: { max: 120, min: 1 },
			notes: 2000,
		});
	});
});
