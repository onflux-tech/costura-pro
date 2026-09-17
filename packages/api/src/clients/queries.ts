import type { Database } from "@costura-pro/db";
import { client } from "@costura-pro/db/schema/clients";
import { type ClientKind, searchTokens } from "@costura-pro/domain/client";
import { ORPCError } from "@orpc/server";
import { and, asc, isNotNull, isNull, sql } from "drizzle-orm";
import z from "zod";

import { commandMessages } from "../command-messages";
import {
	clientSnapshot,
	listProfiles,
	profileSnapshot,
	readClient,
} from "./store";

export const clientPageSize = 50;

export const clientListInput = z.object({
	archived: z.boolean().default(false),
	offset: z.number().int().nonnegative().default(0),
	query: z.string().max(100).optional(),
});

export type ClientListItem = {
	anonymizedAt: string | null;
	archivedAt: string | null;
	id: string;
	kind: ClientKind;
	name: string;
	phone: string | null;
	profileCount: number;
	updatedAt: string;
	version: number;
};

const likeSpecial = /[\\%_]/g;

function containing(token: string): string {
	return `%${token.replace(likeSpecial, (character) => `\\${character}`)}%`;
}

type Reader = Pick<Database, "select">;

export function listClients(
	db: Reader,
	{ archived, offset, query }: z.output<typeof clientListInput>
): { items: ClientListItem[]; nextOffset: number | null } {
	const filters = [
		archived ? isNotNull(client.archivedAt) : isNull(client.archivedAt),
		...searchTokens(query ?? "").map(
			(token) => sql`${client.searchText} LIKE ${containing(token)} ESCAPE '\\'`
		),
	];
	const rows = db
		.select({
			anonymizedAt: client.anonymizedAt,
			archivedAt: client.archivedAt,
			id: client.id,
			kind: client.kind,
			name: client.name,
			phone: client.phone,
			profileCount: sql<number>`(SELECT count(*) FROM client_profile AS profile WHERE profile.client_id = "client"."id" AND profile.archived_at IS NULL)`,
			updatedAt: client.updatedAt,
			version: client.version,
		})
		.from(client)
		.where(and(...filters))
		.orderBy(asc(client.searchText), asc(client.id))
		.limit(clientPageSize + 1)
		.offset(offset)
		.all();
	return {
		items: rows.slice(0, clientPageSize).map((row) => ({
			...row,
			anonymizedAt: row.anonymizedAt?.toISOString() ?? null,
			archivedAt: row.archivedAt?.toISOString() ?? null,
			updatedAt: row.updatedAt.toISOString(),
		})),
		nextOffset: rows.length > clientPageSize ? offset + clientPageSize : null,
	};
}

export function getClient(db: Reader, clientId: string) {
	const row = readClient(db, clientId);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: commandMessages.clientNotFound,
		});
	}
	return {
		client: { ...clientSnapshot(row), updatedAt: row.updatedAt.toISOString() },
		profiles: listProfiles(db, clientId).map(profileSnapshot),
	};
}
