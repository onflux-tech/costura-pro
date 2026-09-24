import { addDays, type QuoteLine } from "./quote";

export const serviceOrderCodePrefix = "OS";

export const approvalChannels = [
	"inPerson",
	"whatsapp",
	"phone",
	"email",
	"other",
] as const;

export type ApprovalChannel = (typeof approvalChannels)[number];

export const approvalLimits = { measurementsPerItem: 50, note: 200 } as const;

export type ApprovalWindowError = "afterValidity" | "beforeEmission";

export function approvalWindowError(
	approvedOn: string,
	revision: { emittedOn: string; validUntil: string }
): ApprovalWindowError | null {
	if (approvedOn < revision.emittedOn) {
		return "beforeEmission";
	}
	return approvedOn > revision.validUntil ? "afterValidity" : null;
}

export function suggestedDueOn(
	approvedOn: string,
	leadTimeDays: number | null
): string | null {
	return leadTimeDays === null ? null : addDays(approvedOn, leadTimeDays);
}

export type WorkLineKind = "custom" | "material" | "service";

const workLineKinds: ReadonlySet<string> = new Set<WorkLineKind>([
	"custom",
	"material",
	"service",
]);

export function isWorkLine<T extends { kind: string }>(
	line: T
): line is T & { kind: WorkLineKind } {
	return workLineKinds.has(line.kind);
}

export type PlannedMaterial = { quantityMicros: bigint; variantId: string };

export function linePlannedMaterials(line: QuoteLine): PlannedMaterial[] {
	if (line.kind === "material") {
		return [
			{
				quantityMicros: line.quantityMicros,
				variantId: line.materialVariantId,
			},
		];
	}
	if (line.kind !== "custom") {
		return [];
	}
	const planned = new Map<string, bigint>();
	for (const component of line.components) {
		if (component.kind === "material") {
			planned.set(
				component.materialVariantId,
				(planned.get(component.materialVariantId) ?? 0n) +
					component.quantityMicros * BigInt(line.quantity)
			);
		}
	}
	return [...planned].map(([variantId, quantityMicros]) => ({
		quantityMicros,
		variantId,
	}));
}
