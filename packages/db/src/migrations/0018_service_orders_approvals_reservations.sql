CREATE TABLE `quote_approval` (
	`approved_on` text NOT NULL,
	`channel` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`note` text,
	`quote_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`service_order_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `quote_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_order_id`) REFERENCES `service_order`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_approval_revision_idx` ON `quote_approval` (`revision_id`);--> statement-breakpoint
CREATE INDEX `quote_approval_quote_idx` ON `quote_approval` (`quote_id`);--> statement-breakpoint
CREATE TABLE `receivable` (
	`amount_cents` integer NOT NULL,
	`client_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`service_order_id` text,
	`version` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_order_id`) REFERENCES `service_order`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receivable_service_order_idx` ON `receivable` (`service_order_id`);--> statement-breakpoint
CREATE INDEX `receivable_client_idx` ON `receivable` (`client_id`);--> statement-breakpoint
CREATE TABLE `service_order` (
	`client_id` text NOT NULL,
	`code` text NOT NULL,
	`code_device` text NOT NULL,
	`code_number` integer NOT NULL,
	`code_year` integer NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`opened_on` text NOT NULL,
	`quote_id` text NOT NULL,
	`search_text` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_order_code_idx` ON `service_order` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_order_code_sequence_idx` ON `service_order` (`code_year`,`code_device`,`code_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_order_quote_idx` ON `service_order` (`quote_id`);--> statement-breakpoint
CREATE INDEX `service_order_client_idx` ON `service_order` (`client_id`);--> statement-breakpoint
CREATE TABLE `service_order_item` (
	`created_at` integer NOT NULL,
	`due_on` text,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`line` text NOT NULL,
	`line_id` text NOT NULL,
	`measurements` text NOT NULL,
	`position` integer NOT NULL,
	`service_order_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`service_order_id`) REFERENCES `service_order`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_order_item_line_idx` ON `service_order_item` (`service_order_id`,`line_id`);--> statement-breakpoint
CREATE TABLE `stock_reservation` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`service_order_item_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`service_order_item_id`) REFERENCES `service_order_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `material_variant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_reservation_variant_idx` ON `stock_reservation` (`variant_id`);--> statement-breakpoint
CREATE INDEX `stock_reservation_item_idx` ON `stock_reservation` (`service_order_item_id`);