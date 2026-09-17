import type { Database } from "@costura-pro/db";
import { client, clientProfile } from "@costura-pro/db/schema/clients";
import { type ClientKind, searchKey } from "@costura-pro/domain/client";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";

import { appendChange } from "../change-log";
import type { ChangeStamp } from "../devices/store";
import type { Executor } from "../executor";

export type ClientRow = typeof client.$inferSelect;
export type ProfileRow = typeof clientProfile.$inferSelect;

export type ClientFields = Pick<
	ClientRow,
	"address" | "email" | "kind" | "name" | "notes" | "phone" | "secondaryPhone"
>;
export type ClientPatch = Partial<
	ClientFields & Pick<ClientRow, "anonymizedAt" | "archivedAt">
>;
export type ProfileFields = Pick<ProfileRow, "clientId" | "name" | "notes">;
export type ProfilePatch = Partial<
	Pick<ProfileRow, "archivedAt" | "name" | "notes">
>;

export type ClientSnapshot = {
	address: string | null;
	anonymizedAt: string | null;
	archivedAt: string | null;
	createdAt: string;
	email: string | null;
	id: string;
	kind: ClientKind;
	name: string;
	notes: string | null;
	phone: string | null;
	secondaryPhone: string | null;
	version: number;
};

export type ProfileSnapshot = {
	archivedAt: string | null;
	clientId: string;
	createdAt: string;
	id: string;
	name: string;
	notes: string | null;
	version: number;
};

type Reader = Pick<Database, "select">;

const isoOrNull = (value: Date | null) => value?.toISOString() ?? null;

export function clientSnapshot(row: ClientRow): ClientSnapshot {
	return {
		address: row.address,
		anonymizedAt: isoOrNull(row.anonymizedAt),
		archivedAt: isoOrNull(row.archivedAt),
		createdAt: row.createdAt.toISOString(),
		email: row.email,
		id: row.id,
		kind: row.kind,
		name: row.name,
		notes: row.notes,
		phone: row.phone,
		secondaryPhone: row.secondaryPhone,
		version: row.version,
	};
}

export function profileSnapshot(row: ProfileRow): ProfileSnapshot {
	return {
		archivedAt: isoOrNull(row.archivedAt),
		clientId: row.clientId,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		notes: row.notes,
		version: row.version,
	};
}

export function readClient(db: Reader, id: string): ClientRow | undefined {
	return db.select().from(client).where(eq(client.id, id)).get();
}

export function readProfile(db: Reader, id: string): ProfileRow | undefined {
	return db.select().from(clientProfile).where(eq(clientProfile.id, id)).get();
}

export function listProfiles(db: Reader, clientId: string): ProfileRow[] {
	return db
		.select()
		.from(clientProfile)
		.where(eq(clientProfile.clientId, clientId))
		.orderBy(asc(clientProfile.name), asc(clientProfile.id))
		.all();
}

export function isProfileAnonymized(db: Reader, row: ProfileRow): boolean {
	return (readClient(db, row.clientId)?.anonymizedAt ?? null) !== null;
}

function searchTextOf(
	fields: Pick<ClientRow, "email" | "name" | "phone" | "secondaryPhone">
) {
	return searchKey({
		email: fields.email,
		name: fields.name,
		phone: fields.phone,
		secondaryPhone: fields.secondaryPhone,
	});
}

function recordClient(db: Executor, row: ClientRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "client",
		data: clientSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

function recordProfile(db: Executor, row: ProfileRow, stamp: ChangeStamp) {
	appendChange(db, {
		aggregateId: row.id,
		aggregateType: "profile",
		data: profileSnapshot(row),
		epoch: stamp.epoch,
		now: stamp.now,
		opId: stamp.opId,
		version: row.version,
	});
}

export function insertClient(
	db: Executor,
	id: string,
	fields: ClientFields,
	stamp: ChangeStamp
): ClientRow {
	const row = db
		.insert(client)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			searchText: searchTextOf(fields),
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordClient(db, row, stamp);
	return row;
}

export function updateClient(
	db: Executor,
	current: ClientRow,
	patch: ClientPatch,
	stamp: ChangeStamp
): ClientRow {
	const next = db
		.update(client)
		.set({
			...patch,
			searchText: searchTextOf({ ...current, ...patch }),
			updatedAt: stamp.now,
			version: current.version + 1,
		})
		.where(and(eq(client.id, current.id), eq(client.version, current.version)))
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Cliente mudou durante a operação",
		});
	}
	recordClient(db, next, stamp);
	return next;
}

export function insertProfile(
	db: Executor,
	id: string,
	fields: ProfileFields,
	stamp: ChangeStamp
): ProfileRow {
	const row = db
		.insert(clientProfile)
		.values({
			...fields,
			createdAt: stamp.now,
			id,
			updatedAt: stamp.now,
			version: 1,
		})
		.returning()
		.get();
	recordProfile(db, row, stamp);
	return row;
}

export function updateProfile(
	db: Executor,
	current: ProfileRow,
	patch: ProfilePatch,
	stamp: ChangeStamp
): ProfileRow {
	const next = db
		.update(clientProfile)
		.set({ ...patch, updatedAt: stamp.now, version: current.version + 1 })
		.where(
			and(
				eq(clientProfile.id, current.id),
				eq(clientProfile.version, current.version)
			)
		)
		.returning()
		.get();
	if (!next) {
		throw new ORPCError("CONFLICT", {
			message: "Perfil mudou durante a operação",
		});
	}
	recordProfile(db, next, stamp);
	return next;
}
