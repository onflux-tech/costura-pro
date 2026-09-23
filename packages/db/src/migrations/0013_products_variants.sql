CREATE TABLE `product` (
	`archived_at` integer,
	`category` text,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`photos` text NOT NULL,
	`search_text` text NOT NULL,
	`sheet` text NOT NULL,
	`target_margin_basis_points` integer,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_variant` (
	`archived_at` integer,
	`code` text,
	`cover_photo_hash` text,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`product_id` text NOT NULL,
	`search_text` text NOT NULL,
	`sheet_changes` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_variant_product_idx` ON `product_variant` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_variant_code_idx` ON `product_variant` (`code`);