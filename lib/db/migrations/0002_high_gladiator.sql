ALTER TABLE `tasks` ADD `failure_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `last_failure_at` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `next_retry_at` integer;