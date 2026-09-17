import { describe, expect, test } from "bun:test";

import {
	anonymizedReceivedItemDescription,
	receivedItemConditions,
	receivedItemLimits,
} from "./received-item";

describe("received item rules", () => {
	test("has the three reception conditions in a fixed order", () => {
		expect(receivedItemConditions).toEqual(["good", "damaged", "worn"]);
	});

	test("limits photos, quantity and text sizes", () => {
		expect(receivedItemLimits).toEqual({
			accessories: 500,
			caption: 40,
			description: { max: 200, min: 1 },
			notes: 2000,
			photos: 12,
			quantity: { max: 999, min: 1 },
		});
		expect(anonymizedReceivedItemDescription).toBe("Peça anonimizada");
	});
});
