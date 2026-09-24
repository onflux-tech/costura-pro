CREATE TABLE `quote` (
	`archived_at` integer,
	`client_id` text NOT NULL,
	`code` text NOT NULL,
	`code_device` text NOT NULL,
	`code_number` integer NOT NULL,
	`code_year` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_on` text NOT NULL,
	`discount` text,
	`id` text PRIMARY KEY NOT NULL,
	`lead_time_days` integer,
	`lines` text NOT NULL,
	`notes` text,
	`refusal_reason` text,
	`refused_on` text,
	`search_text` text NOT NULL,
	`updated_at` integer NOT NULL,
	`validity_days` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_code_idx` ON `quote` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_code_sequence_idx` ON `quote` (`code_year`,`code_device`,`code_number`);--> statement-breakpoint
CREATE INDEX `quote_client_idx` ON `quote` (`client_id`);--> statement-breakpoint
CREATE TABLE `quote_revision` (
	`content` text NOT NULL,
	`cost_cents` integer,
	`created_at` integer NOT NULL,
	`discount_cents` integer NOT NULL,
	`emitted_on` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`quote_id` text NOT NULL,
	`reason` text,
	`target_margin_basis_points` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`valid_until` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_revision_number_idx` ON `quote_revision` (`quote_id`,`number`);