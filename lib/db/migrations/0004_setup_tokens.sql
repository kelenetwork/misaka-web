CREATE TABLE `setup_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`approved_by` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
