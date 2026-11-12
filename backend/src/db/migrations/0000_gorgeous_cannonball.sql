CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`rm_name` text NOT NULL,
	`opened_on` text NOT NULL,
	`approved_on` text,
	`status` text NOT NULL,
	`is_synthetic` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client_type` text NOT NULL,
	`is_synthetic` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`requirement_code` text NOT NULL,
	`issued_on` text,
	`expires_on` text,
	`legible` integer NOT NULL,
	`submitted_on` text NOT NULL,
	`is_synthetic` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requirement_code`) REFERENCES `requirement_types`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`case_id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`source` text NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`updated_on` text NOT NULL,
	`is_synthetic` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_on` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`is_synthetic` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirement_types` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`applies_to` text NOT NULL,
	`reason_text` text NOT NULL,
	`max_age_days` integer,
	`is_synthetic` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`requirement_code` text NOT NULL,
	`requested_on` text,
	`received_on` text,
	`status` text NOT NULL,
	`is_synthetic` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requirement_code`) REFERENCES `requirement_types`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requirements_case_code_idx` ON `requirements` (`case_id`,`requirement_code`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`type` text NOT NULL,
	`due_on` text NOT NULL,
	`done_on` text,
	`cancelled_on` text,
	`is_synthetic` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
