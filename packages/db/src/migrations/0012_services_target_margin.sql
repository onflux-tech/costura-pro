CREATE TABLE `service` (
	`archived_at` integer,
	`category` text,
	`cost_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`estimated_minutes` integer,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`outsourced` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`search_text` text NOT NULL,
	`target_margin_basis_points` integer,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `installation` ADD `target_margin_basis_points` integer DEFAULT 4000 NOT NULL;