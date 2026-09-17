import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mediaTypeValues = ["image/jpeg", "image/webp"] as const;

export const mediaFile = sqliteTable("media_file", {
	byteSize: integer("byte_size").notNull(),
	hash: text("hash").primaryKey(),
	mime: text("mime", { enum: mediaTypeValues }).notNull(),
	uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull(),
});
