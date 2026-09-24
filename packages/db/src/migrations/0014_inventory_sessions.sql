CREATE TABLE `inventory_session` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`lines` text NOT NULL,
	`notes` text,
	`occurred_on` text NOT NULL,
	`reason` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `inventory_session_id` text REFERENCES inventory_session(id);--> statement-breakpoint
CREATE INDEX `stock_movement_inventory_session_idx` ON `stock_movement` (`inventory_session_id`);