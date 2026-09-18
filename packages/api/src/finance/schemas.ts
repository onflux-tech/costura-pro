import {
	financeLimits,
	financialAccountKinds,
} from "@costura-pro/domain/finance";
import z from "zod";

import {
	hasChange,
	moneyCentsSchema,
	optionalText,
	signedMoneyCentsSchema,
} from "../schemas";

const accountNameField = z
	.string()
	.trim()
	.min(financeLimits.accountName.min)
	.max(financeLimits.accountName.max);

const accountKindField = z.enum(financialAccountKinds);

const notesField = optionalText(financeLimits.notes);

export const financeReasonField = z
	.string()
	.trim()
	.min(financeLimits.reason.min)
	.max(financeLimits.reason.max);

export const occurredOnField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const positiveMoney = moneyCentsSchema.refine(
	(value) => BigInt(value) > 0n,
	"Valor precisa ser maior que zero"
);

const nonZeroMoney = signedMoneyCentsSchema.refine(
	(value) => BigInt(value) !== 0n,
	"Valor precisa ser diferente de zero"
);

export const financialAccountCreatePayload = z.object({
	kind: accountKindField,
	name: accountNameField,
	notes: notesField.default(null),
});

export const financialAccountPatchPayload = z
	.object({
		kind: accountKindField.optional(),
		name: accountNameField.optional(),
		notes: notesField.optional(),
	})
	.refine(hasChange, "Nada para alterar");

export const financialMovementCreatePayload = z.object({
	accountId: z.uuid(),
	amountCents: nonZeroMoney,
	kind: z.literal("opening"),
	occurredOn: occurredOnField,
	reason: notesField.default(null),
});

export const financialMovementTransferPayload = z
	.object({
		amountCents: positiveMoney,
		fromAccountId: z.uuid(),
		inboundId: z.uuid(),
		occurredOn: occurredOnField,
		reason: notesField.default(null),
		toAccountId: z.uuid(),
	})
	.refine(
		(values) => values.fromAccountId !== values.toAccountId,
		"Origem e destino precisam ser diferentes"
	);

export const financialMovementReversePayload = z.object({
	counterpartId: z.uuid().nullable().default(null),
	occurredOn: occurredOnField,
	reason: financeReasonField,
	reversesMovementId: z.uuid(),
});
