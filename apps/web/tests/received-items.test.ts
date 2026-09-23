import { describe, expect, test } from "bun:test";

import {
	changedReceivedItem,
	custodyGroups,
	custodyLine,
	firstInvalidField,
	formValuesOf,
	itemSummary,
	parseQuantity,
	type ReceivedItemView,
	receivedItemDateErrors,
	receivedItemFields,
	receivedItemFormErrors,
} from "../src/lib/received-items";

function item(overrides: Partial<ReceivedItemView> = {}): ReceivedItemView {
	return {
		accessories: null,
		archivedAt: null,
		clientId: "c",
		condition: "good",
		createdAt: "2026-09-17T10:00:00.000Z",
		description: "Vestido longo verde",
		expectedReturnOn: null,
		id: "i",
		notes: null,
		photos: [],
		quantity: 1,
		receivedOn: "2026-09-02",
		returnedOn: null,
		version: 1,
		...overrides,
	};
}

describe("custodyGroups", () => {
	test("keeps active items without return in custody and the rest apart, in order", () => {
		const active = item({ expectedReturnOn: "2026-09-30", id: "a" });
		const returned = item({ id: "b", returnedOn: "2026-09-10" });
		const archived = item({ archivedAt: "2026-09-11T00:00:00.000Z", id: "c" });
		const later = item({ expectedReturnOn: "2026-09-20", id: "d" });
		expect(custodyGroups([active, returned, archived, later])).toEqual({
			inCustody: [active, later],
			others: [returned, archived],
		});
	});
});

describe("dates", () => {
	test("refuses reception in the future and returns before the reception", () => {
		expect(
			receivedItemDateErrors(
				{ expectedReturnOn: "2026-09-01", receivedOn: "2026-09-02" },
				"2026-09-17"
			)
		).toEqual({ expectedReturnOn: "Devolução prevista antes da recepção" });
		expect(
			receivedItemDateErrors(
				{ expectedReturnOn: "", receivedOn: "2026-09-18" },
				"2026-09-17"
			)
		).toEqual({ receivedOn: "Data de recepção inválida" });
		expect(
			receivedItemDateErrors(
				{
					expectedReturnOn: "",
					receivedOn: "2026-09-02",
					returnedOn: "2026-09-01",
				},
				"2026-09-17"
			)
		).toEqual({ returnedOn: "Devolução antes da recepção" });
		expect(
			receivedItemDateErrors(
				{
					expectedReturnOn: "",
					receivedOn: "2026-09-02",
					returnedOn: "2026-09-18",
				},
				"2026-09-17"
			)
		).toEqual({ returnedOn: "Devolução no futuro" });
	});

	test("refuses a date outside the day format, like a five digit year", () => {
		expect(
			receivedItemDateErrors(
				{
					expectedReturnOn: "60926-02-20",
					receivedOn: "2026-09-02",
					returnedOn: "20260-09-03",
				},
				"2026-09-17"
			)
		).toEqual({
			expectedReturnOn: "Data inválida",
			returnedOn: "Data inválida",
		});
		expect(
			receivedItemDateErrors(
				{ expectedReturnOn: "", receivedOn: "12026-09-02" },
				"2026-09-17"
			)
		).toEqual({ receivedOn: "Data de recepção inválida" });
	});

	test("accepts the same day for every date", () => {
		expect(
			receivedItemDateErrors(
				{
					expectedReturnOn: "2026-09-02",
					receivedOn: "2026-09-02",
					returnedOn: "2026-09-02",
				},
				"2026-09-02"
			)
		).toEqual({});
	});
});

describe("form", () => {
	const blank = {
		accessories: "",
		condition: null,
		description: " ",
		expectedReturnOn: "",
		notes: "",
		photos: [],
		quantity: "0",
		receivedOn: "2026-09-17",
	} as const;

	test("points the first invalid field in screen order", () => {
		const errors = receivedItemFormErrors(blank, "2026-09-17");
		expect(errors).toEqual({
			condition: "Escolha o estado da peça",
			description: "Descreva a peça",
			quantity: "Informe de 1 a 999 unidades",
		});
		expect(firstInvalidField(errors)).toBe("description");
		expect(parseQuantity("12")).toBe(12);
		expect(parseQuantity("1000")).toBeNull();
		expect(parseQuantity("1,5")).toBeNull();
	});

	test("applies the date rules and refuses a reception after the registered return", () => {
		const valid = {
			...blank,
			condition: "good",
			description: "Vestido",
			quantity: "1",
		} as const;
		expect(
			receivedItemFormErrors(
				{ ...valid, receivedOn: "2026-09-18" },
				"2026-09-17"
			)
		).toEqual({ receivedOn: "Data de recepção inválida" });
		expect(
			receivedItemFormErrors(
				{ ...valid, receivedOn: "2026-09-15" },
				"2026-09-17",
				"2026-09-10"
			)
		).toEqual({ receivedOn: "Recepção depois da devolução" });
		expect(
			receivedItemFormErrors(
				{ ...valid, receivedOn: "2026-09-10" },
				"2026-09-17",
				"2026-09-10"
			)
		).toEqual({});
	});

	test("normalizes texts and builds a patch only with what changed", () => {
		const opened = item({ accessories: "Cinto", notes: "Forro" });
		const values = {
			...formValuesOf(opened),
			accessories: "  ",
			notes: "Forro",
			photos: [{ caption: "frente", photoHash: "a", thumbnailHash: "b" }],
			quantity: "2",
		};
		const fields = receivedItemFields(values);
		expect(fields).toMatchObject({
			accessories: null,
			notes: "Forro",
			quantity: 2,
		});
		expect(fields && changedReceivedItem(opened, fields)).toEqual({
			accessories: null,
			photos: [{ caption: "frente", photoHash: "a", thumbnailHash: "b" }],
			quantity: 2,
		});
		const unchanged = receivedItemFields(formValuesOf(opened));
		expect(unchanged && changedReceivedItem(opened, unchanged)).toBeNull();
	});
});

describe("items", () => {
	test("describes items for the screen", () => {
		expect(custodyLine(item({ expectedReturnOn: "2026-09-26" }))).toBe(
			"recebida 02/09 · devolução prevista 26/09"
		);
		expect(custodyLine(item({ returnedOn: "2026-09-20" }))).toBe(
			"recebida 02/09 · devolvida 20/09"
		);
		expect(itemSummary(item({ accessories: "com cinto" }))).toBe(
			"bom · 1 un · com cinto"
		);
	});
});
