import {
	type ClientKind,
	clientFieldLength,
	clientKinds,
	formatPhone,
	normalizePhone,
} from "@costura-pro/domain/client";
import z from "zod";

export type ClientFormValues = {
	address: string;
	email: string;
	kind: ClientKind;
	name: string;
	notes: string;
	phone: string;
	secondaryPhone: string;
};

export type ClientPayload = {
	address: string | null;
	email: string | null;
	kind: ClientKind;
	name: string;
	notes: string | null;
	phone: string | null;
	secondaryPhone: string | null;
};

export const emptyClientForm: ClientFormValues = {
	address: "",
	email: "",
	kind: "person",
	name: "",
	notes: "",
	phone: "",
	secondaryPhone: "",
};

const phoneMessage = "Telefone com DDD, como (81) 99815-4402";

const limit = (max: number) => `Use até ${max} caracteres`;

const phoneField = z
	.string()
	.refine(
		(value) => value.trim() === "" || normalizePhone(value) !== null,
		phoneMessage
	);

const nameField = z
	.string()
	.trim()
	.min(clientFieldLength.name.min, "Informe o nome")
	.max(clientFieldLength.name.max, limit(clientFieldLength.name.max));

const notesField = z
	.string()
	.trim()
	.max(clientFieldLength.notes, limit(clientFieldLength.notes));

export const clientFormSchema = z.object({
	address: z
		.string()
		.trim()
		.max(clientFieldLength.address, limit(clientFieldLength.address)),
	email: z
		.string()
		.trim()
		.max(clientFieldLength.email, limit(clientFieldLength.email))
		.refine(
			(value) => value === "" || z.email().safeParse(value).success,
			"E-mail inválido"
		),
	kind: z.enum(clientKinds),
	name: nameField,
	notes: notesField,
	phone: phoneField,
	secondaryPhone: phoneField,
});

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function toClientPayload(values: ClientFormValues): ClientPayload {
	return {
		address: orNull(values.address),
		email: orNull(values.email),
		kind: values.kind,
		name: values.name.trim(),
		notes: orNull(values.notes),
		phone: orNull(values.phone),
		secondaryPhone: orNull(values.secondaryPhone),
	};
}

export function formValuesOf(client: ClientPayload): ClientFormValues {
	return {
		address: client.address ?? "",
		email: client.email ?? "",
		kind: client.kind,
		name: client.name,
		notes: client.notes ?? "",
		phone: client.phone ? formatPhone(client.phone) : "",
		secondaryPhone: client.secondaryPhone
			? formatPhone(client.secondaryPhone)
			: "",
	};
}

function comparable(key: keyof ClientPayload, value: string | null) {
	const isPhone = key === "phone" || key === "secondaryPhone";
	return isPhone && value !== null ? normalizePhone(value) : value;
}

export function changedClientFields(
	initial: ClientFormValues,
	values: ClientFormValues
): Partial<ClientPayload> {
	const before = toClientPayload(initial);
	const after = toClientPayload(values);
	const keys = Object.keys(after) as (keyof ClientPayload)[];
	return Object.fromEntries(
		keys
			.filter(
				(key) => comparable(key, before[key]) !== comparable(key, after[key])
			)
			.map((key) => [key, after[key]])
	);
}

export type ProfileFormValues = { name: string; notes: string };

export const profileFormSchema = z.object({
	name: nameField,
	notes: notesField,
});

export function toProfilePayload(values: ProfileFormValues) {
	return { name: values.name.trim(), notes: orNull(values.notes) };
}

export function changedProfileFields(
	initial: ProfileFormValues,
	values: ProfileFormValues
): Partial<ReturnType<typeof toProfilePayload>> {
	const before = toProfilePayload(initial);
	const after = toProfilePayload(values);
	return {
		...(before.name === after.name ? {} : { name: after.name }),
		...(before.notes === after.notes ? {} : { notes: after.notes }),
	};
}
