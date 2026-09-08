CREATE TABLE `seeds` (
	`id` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`seed` text NOT NULL,
	`map` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`best` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_seeds_profile_created` ON `seeds` (`profile`,`created`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `seed` text DEFAULT '' NOT NULL;