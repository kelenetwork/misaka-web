CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`ip` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`rejection_reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`details` text,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `inventory_snapshots` (
	`region` text NOT NULL,
	`plan_id` integer NOT NULL,
	`available` integer NOT NULL,
	`plan_slug` text NOT NULL,
	`plan_name` text NOT NULL,
	`price_monthly` real NOT NULL,
	`price_semiannual` real,
	`price_annual` real,
	`vcores` integer NOT NULL,
	`memory_mb` integer NOT NULL,
	`disk_mb` integer NOT NULL,
	`transfer_mb` integer NOT NULL,
	`network_billing_model` text,
	`routing_profile` text,
	`nvme` integer DEFAULT false NOT NULL,
	`tags` text,
	`unavailable_reason` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`region`, `plan_id`)
);
--> statement-breakpoint
CREATE TABLE `misaka_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`email` text NOT NULL,
	`password_encrypted` text NOT NULL,
	`session_cache_encrypted` text,
	`last_login_at` integer,
	`last_login_ip` text,
	`status` text DEFAULT 'active' NOT NULL,
	`rate_limited_until` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`region` text NOT NULL,
	`plan_id` integer NOT NULL,
	`plan_slug` text NOT NULL,
	`region_name` text NOT NULL,
	`price` real NOT NULL,
	`misaka_order_id` integer,
	`invoice_id` integer,
	`stripe_link` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `misaka_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_misaka_order_id_unique` ON `orders` (`misaka_order_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`facility` text,
	`country_code` text NOT NULL,
	`country` text NOT NULL,
	`continent` text,
	`type` text,
	`lat` real,
	`lng` real,
	`tags` text,
	`available` integer DEFAULT true NOT NULL,
	`unavailable_reason` text,
	`certificates` text,
	`speedtests` text,
	`description` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `system_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`plan_id` integer NOT NULL,
	`max_price` real NOT NULL,
	`target_count` integer NOT NULL,
	`image` text DEFAULT 'debian-12' NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`coupon` text,
	`ssh_keys` text,
	`enabled` integer DEFAULT true NOT NULL,
	`current_count` integer DEFAULT 0 NOT NULL,
	`stop_after_target` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `misaka_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`telegram_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_user_id_unique` ON `users` (`telegram_user_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
