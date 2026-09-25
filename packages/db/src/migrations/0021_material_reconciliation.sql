CREATE TABLE `material_reconciliation` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`lines` text NOT NULL,
	`note` text,
	`occurred_on` text NOT NULL,
	`service_order_item_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`service_order_item_id`) REFERENCES `service_order_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `material_reconciliation_item_idx` ON `material_reconciliation` (`service_order_item_id`);--> statement-breakpoint
CREATE TABLE `material_reconciliation_reversal` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`occurred_on` text NOT NULL,
	`reason` text NOT NULL,
	`reconciliation_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`reconciliation_id`) REFERENCES `material_reconciliation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `material_reconciliation_reversal_idx` ON `material_reconciliation_reversal` (`reconciliation_id`);--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `material_reconciliation_id` text REFERENCES material_reconciliation(id);--> statement-breakpoint
CREATE INDEX `stock_movement_material_reconciliation_idx` ON `stock_movement` (`material_reconciliation_id`);