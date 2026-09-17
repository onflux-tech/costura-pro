import { describe, expect, test } from "bun:test";

import {
	changedClientFields,
	changedProfileFields,
	clientFormSchema,
	emptyClientForm,
	formValuesOf,
	toClientPayload,
} from "../src/atendimento/client-form-values";

const filled = {
	...emptyClientForm,
	email: " maria@email.com ",
	name: " Maria Beatriz ",
	phone: "(81) 99815-4402",
};

describe("valores do formulário de cliente", () => {
	test("envia texto aparado e vazio como null", () => {
		expect(toClientPayload(filled)).toEqual({
			address: null,
			email: "maria@email.com",
			kind: "person",
			name: "Maria Beatriz",
			notes: null,
			phone: "(81) 99815-4402",
			secondaryPhone: null,
		});
	});

	test("recusa telefone sem DDD e e-mail inválido com mensagem em português", () => {
		const result = clientFormSchema.safeParse({
			...filled,
			email: "maria@",
			phone: "99815-4402",
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message).sort()).toEqual([
			"E-mail inválido",
			"Telefone com DDD, como (81) 99815-4402",
		]);
	});

	test("edição manda só o que mudou, comparando telefone pelos dígitos", () => {
		const initial = formValuesOf({
			address: null,
			email: "maria@email.com",
			kind: "person",
			name: "Maria Beatriz",
			notes: null,
			phone: "81998154402",
			secondaryPhone: null,
		});
		expect(initial.phone).toBe("(81) 99815-4402");
		expect(
			changedClientFields(initial, { ...initial, phone: "81 99815 4402" })
		).toEqual({});
		expect(
			changedClientFields(initial, {
				...initial,
				notes: "Barra alta",
				phone: "",
			})
		).toEqual({ notes: "Barra alta", phone: null });
	});

	test("perfil manda só o que mudou", () => {
		expect(
			changedProfileFields(
				{ name: "Helena", notes: "" },
				{ name: "Helena ", notes: "Infantil" }
			)
		).toEqual({ notes: "Infantil" });
	});
});
