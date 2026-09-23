import { orpc } from "@/utils/orpc";

export function pricingSettingsQuery() {
	return orpc.pricing.settings.queryOptions({
		input: {},
		meta: { silent: true },
	});
}
