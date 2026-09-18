import {
	clientFieldLength,
	clientKinds,
	normalizePhone,
} from "@costura-pro/domain/client";
import z from "zod";

import { hasChange, optionalText } from "../schemas";

export const phoneField = z
	.string()
	.nullable()
	.transform((value, context) => {
		if (value === null || value.trim() === "") {
			return null;
		}
		const digits = normalizePhone(value);
		if (!digits) {
			context.addIssue({ code: "custom", message: "Telefone inválido" });
			return z.NEVER;
		}
		return digits;
	});

export const emailField = optionalText(clientFieldLength.email).pipe(
	z.email().nullable()
);

const nameField = z
	.string()
	.trim()
	.min(clientFieldLength.name.min)
	.max(clientFieldLength.name.max);

const kindField = z.enum(clientKinds);

const notesField = optionalText(clientFieldLength.notes);

export const clientCreatePayload = z.object({
	address: optionalText(clientFieldLength.address).default(null),
	email: emailField.default(null),
	kind: kindField,
	name: nameField,
	notes: notesField.default(null),
	phone: phoneField.default(null),
	secondaryPhone: phoneField.default(null),
});

export const clientPatchPayload = z
	.object({
		address: optionalText(clientFieldLength.address).optional(),
		email: emailField.optional(),
		kind: kindField.optional(),
		name: nameField.optional(),
		notes: notesField.optional(),
		phone: phoneField.optional(),
		secondaryPhone: phoneField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

export const profileCreatePayload = z.object({
	clientId: z.uuid(),
	name: nameField,
	notes: notesField.default(null),
});

export const profilePatchPayload = z
	.object({ name: nameField.optional(), notes: notesField.optional() })
	.refine(hasChange, "Nada para alterar");
