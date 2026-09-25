import { measurementLimits } from "@costura-pro/domain/measurement";
import { productionLimits } from "@costura-pro/domain/production";
import { quoteLimits } from "@costura-pro/domain/quote";
import {
	approvalChannels,
	approvalLimits,
} from "@costura-pro/domain/service-order";
import z from "zod";

import { measurementFieldsPayload } from "../measurements/schemas";
import { optionalText, whenShapeIsValid } from "../schemas";

const distinct = (ids: readonly string[]) => new Set(ids).size === ids.length;

export const measurementSnapshotPayload = z.object({
	fields: measurementFieldsPayload,
	measurementId: z.uuid(),
	notes: optionalText(measurementLimits.notes).default(null),
	takenOn: z.iso.date(),
	templateId: z.uuid(),
	templateName: z
		.string()
		.trim()
		.min(measurementLimits.templateName.min)
		.max(measurementLimits.templateName.max),
	templateVersion: z.number().int().positive(),
});

const reservationPayload = z.object({
	reservationId: z.uuid(),
	variantId: z.uuid(),
});

export const approvalItemPayload = z.object({
	itemId: z.uuid(),
	lineId: z.uuid(),
	measurements: z
		.array(measurementSnapshotPayload)
		.max(approvalLimits.measurementsPerItem)
		.refine((items) => distinct(items.map((item) => item.measurementId)), {
			...whenShapeIsValid,
			message: "Medição repetida",
		}),
	reservations: z
		.array(reservationPayload)
		.max(quoteLimits.components)
		.refine((items) => distinct(items.map((item) => item.variantId)), {
			...whenShapeIsValid,
			message: "Variante repetida",
		}),
});

type ApprovalShape = {
	items: { itemId: string; reservations: { reservationId: string }[] }[];
	receivableId: string;
	serviceOrderId: string;
};

function payloadIds(fields: ApprovalShape): string[] {
	return [
		fields.serviceOrderId,
		fields.receivableId,
		...fields.items.map((item) => item.itemId),
		...fields.items.flatMap((item) =>
			item.reservations.map((reservation) => reservation.reservationId)
		),
	];
}

export const quoteApprovePayload = z
	.object({
		approvedOn: z.iso.date(),
		channel: z.enum(approvalChannels),
		dueOn: z.iso.date().nullable().default(null),
		items: z
			.array(approvalItemPayload)
			.max(quoteLimits.lines)
			.refine((items) => distinct(items.map((item) => item.lineId)), {
				...whenShapeIsValid,
				message: "Linha repetida",
			}),
		note: optionalText(approvalLimits.note).default(null),
		quoteId: z.uuid(),
		receivableId: z.uuid(),
		revisionId: z.uuid(),
		serviceOrderId: z.uuid(),
	})
	.refine(
		(fields) => fields.dueOn === null || fields.dueOn >= fields.approvedOn,
		{ ...whenShapeIsValid, message: "Prazo antes da aprovação" }
	)
	.refine((fields) => distinct(payloadIds(fields)), {
		...whenShapeIsValid,
		message: "Id repetido",
	});

export type QuoteApproveValues = z.output<typeof quoteApprovePayload>;

export const productionStartPayload = z.object({
	stageIds: z
		.array(z.uuid())
		.min(1)
		.max(productionLimits.activeStages.max)
		.refine(distinct, { ...whenShapeIsValid, message: "Etapa repetida" }),
});
