import type { Database } from "@costura-pro/db";
import { service } from "@costura-pro/db/schema/services";
import { searchTokens } from "@costura-pro/domain/client";
import { serviceLimits } from "@costura-pro/domain/service";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import z from "zod";

import { commandMessages } from "../command-messages";
import { readInstallation } from "../installation/store";
import { containing } from "../search";
import {
	readService,
	type ServiceRow,
	type ServiceSnapshot,
	serviceSnapshot,
} from "./store";

export const servicePageSize = 50;

export const serviceListInput = z.object({
	archived: z.boolean().default(false),
	category: z.string().max(serviceLimits.category).optional(),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export type ServiceListItem = ServiceSnapshot & { updatedAt: string };

type Reader = Pick<Database, "select" | "selectDistinct">;

function serviceItem(row: ServiceRow): ServiceListItem {
	return { ...serviceSnapshot(row), updatedAt: row.updatedAt.toISOString() };
}

export function listServices(
	db: Reader,
	{ archived, category, offset, query }: z.output<typeof serviceListInput>
): { items: ServiceListItem[]; nextOffset: number | null } {
	const filters = [
		archived ? isNotNull(service.archivedAt) : isNull(service.archivedAt),
		...(category === undefined
			? []
			: [
					category === ""
						? isNull(service.category)
						: eq(service.category, category),
				]),
		...searchTokens(query ?? "").map(
			(token) =>
				sql`${service.searchText} LIKE ${containing(token)} ESCAPE '\\'`
		),
	];
	const rows = db
		.select()
		.from(service)
		.where(and(...filters))
		.orderBy(asc(service.searchText), asc(service.id))
		.limit(servicePageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, servicePageSize).map(serviceItem),
		nextOffset: rows.length > servicePageSize ? offset + servicePageSize : null,
	};
}

export function listServiceCategories(db: Reader): { categories: string[] } {
	return {
		categories: db
			.selectDistinct({ category: service.category })
			.from(service)
			.where(and(isNull(service.archivedAt), isNotNull(service.category)))
			.orderBy(asc(service.category))
			.all()
			.flatMap((row) => (row.category === null ? [] : [row.category])),
	};
}

export function getService(db: Reader, serviceId: string): ServiceListItem {
	const row = readService(db, serviceId);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.serviceNotFound,
		});
	}
	return serviceItem(row);
}

export function pricingSettings(db: Reader): {
	targetMarginBasisPoints: number;
	version: number;
} {
	const { targetMarginBasisPoints, version } = readInstallation(db);
	return { targetMarginBasisPoints, version };
}
