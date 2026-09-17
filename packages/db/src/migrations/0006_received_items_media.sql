CREATE TABLE `media_file` (
	`byte_size` integer NOT NULL,
	`hash` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`uploaded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `received_item` (
	`accessories` text,
	`archived_at` integer,
	`client_id` text NOT NULL,
	`condition` text NOT NULL,
	`created_at` integer NOT NULL,
	`description` text NOT NULL,
	`expected_return_on` text,
	`id` text PRIMARY KEY NOT NULL,
	`notes` text,
	`photos` text NOT NULL,
	`quantity` integer NOT NULL,
	`received_on` text NOT NULL,
	`returned_on` text,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `received_item_client_idx` ON `received_item` (`client_id`);