CREATE TABLE `client` (
	`address` text,
	`anonymized_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`email` text,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`phone` text,
	`search_text` text NOT NULL,
	`secondary_phone` text,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `client_profile` (
	`archived_at` integer,
	`client_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_profile_client_idx` ON `client_profile` (`client_id`);--> statement-breakpoint
CREATE TABLE `redacted_aggregate` (
	`aggregate_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`op_id` text NOT NULL,
	`redacted_at` integer NOT NULL,
	PRIMARY KEY(`aggregate_type`, `aggregate_id`)
);
--> statement-breakpoint
CREATE INDEX `change_log_aggregate_idx` ON `change_log` (`aggregate_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `operation_aggregate_idx` ON `operation` (`aggregate_type`,`aggregate_id`);