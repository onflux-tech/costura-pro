CREATE TABLE `financial_account` (
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `financial_movement` (
	`account_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`obligation_id` text,
	`occurred_on` text NOT NULL,
	`reason` text,
	`reverses_movement_id` text,
	`transfer_id` text,
	`version` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `financial_account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`obligation_id`) REFERENCES `obligation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reverses_movement_id`) REFERENCES `financial_movement`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `financial_movement_account_idx` ON `financial_movement` (`account_id`);--> statement-breakpoint
CREATE INDEX `financial_movement_transfer_idx` ON `financial_movement` (`transfer_id`);--> statement-breakpoint
CREATE INDEX `financial_movement_obligation_idx` ON `financial_movement` (`obligation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `financial_movement_reverses_idx` ON `financial_movement` (`reverses_movement_id`);--> statement-breakpoint
CREATE TABLE `obligation` (
	`amount_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`due_on` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`purchase_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obligation_purchase_idx` ON `obligation` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `obligation_due_idx` ON `obligation` (`due_on`);--> statement-breakpoint
CREATE TABLE `purchase` (
	`created_at` integer NOT NULL,
	`discount_cents` integer NOT NULL,
	`freight_cents` integer NOT NULL,
	`gross_cents` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
	`notes` text,
	`occurred_on` text NOT NULL,
	`reference` text,
	`supplier_id` text NOT NULL,
	`total_cents` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchase_supplier_idx` ON `purchase` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `purchase_reversal` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`occurred_on` text NOT NULL,
	`purchase_id` text NOT NULL,
	`reason` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_reversal_purchase_idx` ON `purchase_reversal` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `supplier` (
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`email` text,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`phone` text,
	`search_text` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `purchase_id` text REFERENCES purchase(id);--> statement-breakpoint
CREATE INDEX `stock_movement_purchase_idx` ON `stock_movement` (`purchase_id`);