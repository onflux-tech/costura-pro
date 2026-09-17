import {
	isValidUsername,
	normalizeUsername,
	passwordLength,
} from "@costura-pro/domain/credentials";
import { atelierNameLength } from "@costura-pro/domain/installation-state";
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

export const hasChange = (patch: Record<string, unknown>) =>
	Object.values(patch).some((value) => value !== undefined);

export const emptyPayload = z.object({});
