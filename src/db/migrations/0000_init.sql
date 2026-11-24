CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`country_iso` text NOT NULL,
	`trip_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`comment` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `expenses_country_idx` ON `expenses` (`country_iso`);--> statement-breakpoint
CREATE INDEX `expenses_trip_idx` ON `expenses` (`trip_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`country_iso` text,
	`trip_id` text,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `notes_country_idx` ON `notes` (`country_iso`);--> statement-breakpoint
CREATE INDEX `notes_trip_idx` ON `notes` (`trip_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`country_iso` text NOT NULL,
	`place_id` text,
	`file_uri` text NOT NULL,
	`thumb_uri` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`taken_at` text,
	`lat` real,
	`lng` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `photos_country_idx` ON `photos` (`country_iso`);--> statement-breakpoint
CREATE INDEX `photos_place_idx` ON `photos` (`place_id`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`country_iso` text NOT NULL,
	`trip_id` text,
	`title` text NOT NULL,
	`lat` real,
	`lng` real,
	`note` text,
	`is_wishlist` integer DEFAULT false NOT NULL,
	`visited_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `places_country_idx` ON `places` (`country_iso`);--> statement-breakpoint
CREATE INDEX `places_trip_idx` ON `places` (`trip_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `trip_countries` (
	`trip_id` text NOT NULL,
	`country_iso` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	PRIMARY KEY(`trip_id`, `country_iso`)
);
--> statement-breakpoint
CREATE INDEX `trip_countries_country_idx` ON `trip_countries` (`country_iso`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`budget` integer,
	`currency` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`country_iso` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `visits_country_idx` ON `visits` (`country_iso`);