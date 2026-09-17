export const receivedItemConditions = ["good", "damaged", "worn"] as const;

export type ReceivedItemCondition = (typeof receivedItemConditions)[number];

export const receivedItemLimits = {
	accessories: 500,
	caption: 40,
	description: { max: 200, min: 1 },
	notes: 2000,
	photos: 12,
	quantity: { max: 999, min: 1 },
} as const;

export const anonymizedReceivedItemDescription = "Peça anonimizada";
