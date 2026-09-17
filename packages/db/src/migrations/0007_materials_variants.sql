CREATE TABLE `material` (
	`archived_at` integer,
	`category` text,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`search_text` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_variant` (
	`archived_at` integer,
	`base_unit` text NOT NULL,
	`code` text,
	`created_at` integer NOT NULL,
	`display_precision` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`min_quantity_micros` integer,
	`name` text NOT NULL,
	`packaging_label` text,
	`packaging_quantity_micros` integer,
	`photo` text,
	`reference_cost_cents` integer,
	`search_text` text NOT NULL,
	`target_quantity_micros` integer,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `material_variant_material_idx` ON `material_variant` (`material_id`);--> statement-breakpoint
CREATE INDEX `material_variant_code_idx` ON `material_variant` (`code`);