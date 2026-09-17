CREATE TABLE `measurement` (
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`fields` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`notes` text,
	`profile_id` text NOT NULL,
	`taken_on` text NOT NULL,
	`template_id` text NOT NULL,
	`template_name` text NOT NULL,
	`template_version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `client_profile`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `measurement_template`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `measurement_profile_idx` ON `measurement` (`profile_id`);--> statement-breakpoint
CREATE TABLE `measurement_template` (
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`fields` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
