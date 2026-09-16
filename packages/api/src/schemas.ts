import {
	isValidUsername,
	normalizeUsername,
	passwordLength,
} from "@costura-pro/domain/credentials";
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

export const atelierNameSchema = z.string().trim().min(1).max(80);

export const deviceNameSchema = z.string().trim().min(1).max(60);
