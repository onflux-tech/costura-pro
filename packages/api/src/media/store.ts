import type { Database } from "@costura-pro/db";
import { mediaFile } from "@costura-pro/db/schema/media";
import { and, eq, lte, sql } from "drizzle-orm";

import type { Executor } from "../executor";

export type MediaFileRow = typeof mediaFile.$inferSelect;

type Reader = Pick<Database, "select">;

export type Querier = Pick<Database, "all">;

type PhotoReference = { photoHash: string; thumbnailHash: string };

function isPhotoReference(value: unknown): value is PhotoReference {
	return (
		typeof value === "object" &&
		value !== null &&
		"photoHash" in value &&
		"thumbnailHash" in value &&
		typeof value.photoHash === "string" &&
		typeof value.thumbnailHash === "string"
	);
}

export function photoHashes(values: unknown): string[] {
	if (
		typeof values !== "object" ||
		values === null ||
		!("photos" in values) ||
		!Array.isArray(values.photos)
	) {
		return [];
	}
	return values.photos
		.filter(isPhotoReference)
		.flatMap((photo) => [photo.photoHash, photo.thumbnailHash]);
}

export function readMediaFile(
	db: Reader,
	hash: string
): MediaFileRow | undefined {
	return db.select().from(mediaFile).where(eq(mediaFile.hash, hash)).get();
}

export function upsertMediaFile(db: Executor, row: MediaFileRow): void {
	db.insert(mediaFile)
		.values(row)
		.onConflictDoUpdate({
			set: {
				byteSize: row.byteSize,
				mime: row.mime,
				uploadedAt: row.uploadedAt,
			},
			target: mediaFile.hash,
		})
		.run();
}

export function deleteMediaFile(db: Executor, hash: string): void {
	db.delete(mediaFile).where(eq(mediaFile.hash, hash)).run();
}

const referencedHashes = sql`
	SELECT json_extract(photo.value, '$.photoHash') AS hash
	FROM received_item AS item, json_each(item.photos) AS photo
	UNION
	SELECT json_extract(photo.value, '$.thumbnailHash')
	FROM received_item AS item, json_each(item.photos) AS photo
	UNION
	SELECT json_extract(photo.value, '$.photoHash')
	FROM sync_conflict AS conflict, json_each(conflict.local_values, '$.photos') AS photo
	WHERE conflict.status = 'open' AND conflict.aggregate_type = 'receivedItem'
	UNION
	SELECT json_extract(photo.value, '$.thumbnailHash')
	FROM sync_conflict AS conflict, json_each(conflict.local_values, '$.photos') AS photo
	WHERE conflict.status = 'open' AND conflict.aggregate_type = 'receivedItem'
	UNION
	SELECT json_extract(photo.value, '$.photoHash')
	FROM sync_conflict AS conflict, json_each(conflict.current_values, '$.photos') AS photo
	WHERE conflict.status = 'open' AND conflict.aggregate_type = 'receivedItem'
	UNION
	SELECT json_extract(photo.value, '$.thumbnailHash')
	FROM sync_conflict AS conflict, json_each(conflict.current_values, '$.photos') AS photo
	WHERE conflict.status = 'open' AND conflict.aggregate_type = 'receivedItem'
`;

export function isMediaReferenced(db: Querier, hash: string): boolean {
	return (
		db.all(
			sql`SELECT 1 AS referenced FROM (${referencedHashes}) AS referenced WHERE referenced.hash = ${hash} LIMIT 1`
		).length > 0
	);
}

export function listUnreferencedMediaFilesUploadedBefore(
	db: Reader,
	cutoff: Date
): MediaFileRow[] {
	return db
		.select()
		.from(mediaFile)
		.where(
			and(
				lte(mediaFile.uploadedAt, cutoff),
				sql`"media_file"."hash" NOT IN (SELECT referenced.hash FROM (${referencedHashes}) AS referenced WHERE referenced.hash IS NOT NULL)`
			)
		)
		.all();
}
