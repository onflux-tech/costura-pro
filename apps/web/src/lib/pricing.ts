import {
	type Pricing,
	parseMarginPercent,
	pricingOf,
	suggestPrice,
} from "@costura-pro/domain/pricing";

export type PricingPreview = {
	ownTarget: boolean;
	pricing: Pricing | null;
	suggestedCents: bigint;
	targetMarginBasisPoints: number;
};

export function ownTargetOf(text: string): number | null {
	return text.trim() === "" ? null : parseMarginPercent(text);
}

export function targetMarginError(text: string): string | null {
	return text.trim() === "" || parseMarginPercent(text) !== null
		? null
		: "Use de 0 a 99,99%";
}

export function pricingPreview(
	item: {
		costCents: string;
		priceCents: string | null;
		targetMarginBasisPoints: number | null;
	},
	atelierTarget: number
): PricingPreview {
	const ownTarget = item.targetMarginBasisPoints !== null;
	const targetMarginBasisPoints = item.targetMarginBasisPoints ?? atelierTarget;
	const costCents = BigInt(item.costCents);
	if (item.priceCents === null) {
		return {
			ownTarget,
			pricing: null,
			suggestedCents: suggestPrice(costCents, targetMarginBasisPoints),
			targetMarginBasisPoints,
		};
	}
	const pricing = pricingOf({
		costCents,
		priceCents: BigInt(item.priceCents),
		targetMarginBasisPoints,
	});
	return {
		ownTarget,
		pricing,
		suggestedCents: pricing.suggestedCents,
		targetMarginBasisPoints,
	};
}
