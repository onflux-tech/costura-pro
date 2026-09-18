import {
	isValidUsername,
	normalizeUsername,
	passwordLength,
} from "@costura-pro/domain/credentials";
import { atelierNameLength } from "@costura-pro/domain/installation-state";
import { maxExactInteger } from "@costura-pro/domain/quantity";
import z from "zod";

export const opIdSchema = z.uuid();

export const passwordSchema = z
	.string()
	.min(passwordLength.min)
	.max(passwordLength.max);

export const usernameSchema = z
	.string()
	.transform(normalizeUsername)
	.refine(isValidUsername, "Usuário inválido");

export const atelierNameSchema = z
	.string()
	.trim()
	.min(atelierNameLength.min)
	.max(atelierNameLength.max);

export const deviceNameSchema = z.string().trim().min(1).max(60);

const blankToNull = (value: string | null) =>
	value === null || value === "" ? null : value;

export const optionalText = (max: number) =>
	z.string().trim().max(max).nullable().transform(blankToNull);

const integerText = /^\d{1,17}$/;

const exactIntegerSchema = z
	.string()
	.refine(
		(value) => integerText.test(value) && BigInt(value) <= maxExactInteger,
		"Valor inteiro inválido"
	)
	.transform((value) => BigInt(value).toString());

export const moneyCentsSchema = exactIntegerSchema;

export const quantityMicrosSchema = exactIntegerSchema;

const signedIntegerText = /^-?\d{1,17}$/;

const signedExactIntegerSchema = z
	.string()
	.refine((value) => {
		if (!signedIntegerText.test(value)) {
			return false;
		}
		const parsed = BigInt(value);
		return parsed <= maxExactInteger && parsed >= -maxExactInteger;
	}, "Valor inteiro inválido")
	.transform((value) => BigInt(value).toString());

export const signedMoneyCentsSchema = signedExactIntegerSchema;

export const signedQuantityMicrosSchema = signedExactIntegerSchema;

export const hasChange = (patch: Record<string, unknown>) =>
	Object.values(patch).some((value) => value !== undefined);

export const emptyPayload = z.object({});

export const whenShapeIsValid = {
	when: (payload: { issues: readonly unknown[] }) =>
		payload.issues.length === 0,
};
