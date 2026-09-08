CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`weapon` text NOT NULL,
	`input` text DEFAULT '{}' NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_members_room_updated` ON `members` (`room`,`updated`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`power` integer DEFAULT 0 NOT NULL,
	`vitality` integer DEFAULT 0 NOT NULL,
	`unlocks` text DEFAULT '[]' NOT NULL,
	`best` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`points` integer NOT NULL,
	`wave` integer NOT NULL,
	`claimed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`name` text NOT NULL,
	`map` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`snapshot` text,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_status_updated` ON `rooms` (`status`,`updated`);