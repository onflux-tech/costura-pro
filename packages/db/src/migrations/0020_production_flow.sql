CREATE TABLE `production_flow` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`stages` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `service_order` ADD `flow_stages` text;--> statement-breakpoint
ALTER TABLE `service_order` ADD `flow_version` integer;--> statement-breakpoint
ALTER TABLE `service_order_item` ADD `production_status` text DEFAULT 'notStarted' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_order_item` ADD `stage_id` text;--> statement-breakpoint
ALTER TABLE `service_order_item` ADD `stage_ids` text;--> statement-breakpoint
ALTER TABLE `service` ADD `suggested_stage_ids` text DEFAULT '[]' NOT NULL;