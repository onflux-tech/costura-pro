import { normalizeText } from "./search";

export const clientKinds = ["person", "organization"] as const;

export type ClientKind = (typeof clientKinds)[number];

export const clientFieldLength = {
	address: 200,
	email: 254,
	name: { max: 120, min: 1 },
	notes: 2000,
} as const;

export const anonymizedClientName = "Cliente anonimizado";
export const anonymizedProfileName = "Perfil anonimizado";

const nonDigit = /\D/g;
const areaCode = /^(?:1[1-9]|[2-9]\d)/;

export function normalizePhone(input: string): string | null {
	const digits = input.replace(nonDigit, "");
	const withCountry =
		(digits.length === 12 || digits.length === 13) && digits.startsWith("55");
	const local = withCountry ? digits.slice(2) : digits;
	if (local.length !== 10 && local.length !== 11) {
		return null;
	}
	return areaCode.test(local) ? local : null;
}

export function formatPhone(digits: string): string {
	const rest = digits.slice(2);
	const split = rest.length - 4;
	return `(${digits.slice(0, 2)}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

export function searchKey(parts: {
	email: string | null;
	name: string;
	phone: string | null;
	secondaryPhone: string | null;
}): string {
	return normalizeText(
		[parts.name, parts.email, parts.phone, parts.secondaryPhone]
			.filter((part): part is string => Boolean(part))
			.join(" ")
	);
}
