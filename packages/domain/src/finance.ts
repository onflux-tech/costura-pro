export const financialAccountKinds = ["cash", "bank", "pix", "other"] as const;

export type FinancialAccountKind = (typeof financialAccountKinds)[number];

export const financialMovementKinds = [
	"opening",
	"transferOut",
	"transferIn",
	"obligationPayment",
	"reversal",
] as const;

export type FinancialMovementKind = (typeof financialMovementKinds)[number];

export const obligationStatuses = ["open", "paid", "cancelled"] as const;

export type ObligationStatus = (typeof obligationStatuses)[number];

export const financeLimits = {
	accountName: { max: 60, min: 1 },
	notes: 2000,
	reason: { max: 200, min: 1 },
} as const;

export function obligationStatus(facts: {
	paid: boolean;
	reversed: boolean;
}): ObligationStatus {
	if (facts.reversed) {
		return "cancelled";
	}
	return facts.paid ? "paid" : "open";
}
