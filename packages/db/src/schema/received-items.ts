import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { client } from "./clients";

export const receivedItemConditionValues = ["good", "damaged", "worn"] as const;

export type ReceivedItemPhotoRow = {
	caption: string | null;
	photoHash: string;
	thumbnailHash: string;
};

export const receivedItem = sqliteTable(
	"received_item",
	{
		accessories: text("accessories"),
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		clientId: text("client_id")
			.notNull()
			.references(() => client.id),
		condition: text("condition", {
			enum: receivedItemConditionValues,
		}).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		description: text("description").notNull(),
		expectedReturnOn: text("expected_return_on"),
		id: text("id").primaryKey(),
		notes: text("notes"),
		photos: text("photos", { mode: "json" })
			.$type<ReceivedItemPhotoRow[]>()
			.notNull(),
		quantity: integer("quantity").notNull(),
		receivedOn: text("received_on").notNull(),
		returnedOn: text("returned_on"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		version: integer("version").notNull(),
	},
	(table) => [index("received_item_client_idx").on(table.clientId)]
);
