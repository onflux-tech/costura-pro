CREATE TABLE `rate_limit` (
	`count` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `audit_event` (
	`access` text NOT NULL,
	`details` text NOT NULL,
	`device_id` text,
	`id` text PRIMARY KEY NOT NULL,
	`ip` text,
	`occurred_at` integer NOT NULL,
	`outcome` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_event_occurred_at_idx` ON `audit_event` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `installation` (
	`atelier_name` text,
	`backup_folder` text,
	`backup_tested_at` integer,
	`created_at` integer NOT NULL,
	`epoch` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`singleton` integer NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "installation_singleton_check" CHECK("installation"."singleton" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installation_singleton_unique` ON `installation` (`singleton`);--> statement-breakpoint
CREATE TABLE `recovery_code` (
	`code_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_code_code_hash_unique` ON `recovery_code` (`code_hash`);--> statement-breakpoint
CREATE TABLE `sign_in_guard` (
	`remote_failures` integer DEFAULT 0 NOT NULL,
	`remote_locked_until` integer,
	`singleton` integer PRIMARY KEY NOT NULL,
	CONSTRAINT "sign_in_guard_singleton_check" CHECK("sign_in_guard"."singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `change_log` (
	`aggregate_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`changed_at` integer NOT NULL,
	`cursor` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data` text NOT NULL,
	`epoch` text NOT NULL,
	`op_id` text,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `device` (
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_seen_at` integer,
	`name` text NOT NULL,
	`revoked_at` integer,
	`secret_hash` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_secret_hash_unique` ON `device` (`secret_hash`);--> statement-breakpoint
CREATE TABLE `device_activation_code` (
	`code_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`device_id` text,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_activation_code_code_hash_unique` ON `device_activation_code` (`code_hash`);--> statement-breakpoint
CREATE TABLE `operation` (
	`aggregate_id` text,
	`aggregate_type` text,
	`base_version` integer,
	`command` text NOT NULL,
	`device_id` text,
	`epoch` text NOT NULL,
	`occurred_at` integer,
	`op_hash` text NOT NULL,
	`op_id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL,
	`result` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `operation_status_idx` ON `operation` (`status`);--> statement-breakpoint
CREATE TABLE `sync_conflict` (
	`aggregate_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`base_version` integer,
	`choice` text,
	`command` text NOT NULL,
	`created_at` integer NOT NULL,
	`current_values` text NOT NULL,
	`current_version` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`local_values` text NOT NULL,
	`op_id` text NOT NULL,
	`reason` text,
	`resolved_at` integer,
	`resolved_by_op_id` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_conflict_op_id_unique` ON `sync_conflict` (`op_id`);--> statement-breakpoint
CREATE INDEX `sync_conflict_status_idx` ON `sync_conflict` (`status`);--> statement-breakpoint
ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);