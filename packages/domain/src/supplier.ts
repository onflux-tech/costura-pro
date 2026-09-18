import { normalizeText } from "./client";

export const supplierLimits = {
	email: 254,
	name: { max: 120, min: 1 },
	notes: 2000,
} as const;

export function supplierSearchKey(parts: {
	email: string | null;
	name: string;
	phone: string | null;
}): string {
	return normalizeText(
		[parts.name, parts.email, parts.phone]
			.filter((part): part is string => Boolean(part))
			.join(" ")
	);
}
