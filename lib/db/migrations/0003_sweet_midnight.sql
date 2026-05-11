CREATE TABLE `worker_health` (
	`worker` text PRIMARY KEY NOT NULL,
	`last_tick_at` integer NOT NULL,
	`last_success_at` integer,
	`last_error` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
