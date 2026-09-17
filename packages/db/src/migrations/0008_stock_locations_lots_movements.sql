CREATE TABLE `stock_balance` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`lot_id` text,
	`quantity_micros` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`value_cents` integer NOT NULL,
	`variant_id` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `stock_location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `stock_lot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `material_variant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_balance_variant_idx` ON `stock_balance` (`variant_id`);--> statement-breakpoint
CREATE TABLE `stock_location` (
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_lot` (
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `material_variant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_lot_variant_idx` ON `stock_lot` (`variant_id`);--> statement-breakpoint
CREATE TABLE `stock_movement` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`location_id` text NOT NULL,
	`lot_id` text,
	`occurred_on` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`reason` text,
	`reverses_movement_id` text,
	`transfer_id` text,
	`value_cents` integer NOT NULL,
	`variant_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `stock_location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `stock_lot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reverses_movement_id`) REFERENCES `stock_movement`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `material_variant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_movement_point_idx` ON `stock_movement` (`variant_id`,`location_id`,`lot_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_transfer_idx` ON `stock_movement` (`transfer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movement_reverses_idx` ON `stock_movement` (`reverses_movement_id`);--> statement-breakpoint
ALTER TABLE `material_variant` ADD `tracks_lots` integer DEFAULT false NOT NULL;