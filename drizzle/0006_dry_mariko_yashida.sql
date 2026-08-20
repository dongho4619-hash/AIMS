CREATE TABLE `app_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`employee_id` text DEFAULT '' NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`can_view_admin` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_user_key_unique` ON `app_users` (`user_key`);--> statement-breakpoint
CREATE TABLE `material_usage_edits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usage_id` integer NOT NULL,
	`editor_user_key` text NOT NULL,
	`changed_fields` text NOT NULL,
	`previous_values` text NOT NULL,
	`new_values` text NOT NULL,
	`edited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_material_usage_edits_usage_time` ON `material_usage_edits` (`usage_id`,`edited_at`);--> statement-breakpoint
CREATE TABLE `material_usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`employee_id` text NOT NULL,
	`material_source_key` text NOT NULL,
	`item_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`store_name` text NOT NULL,
	`used_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_material_usages_user_date` ON `material_usages` (`user_key`,`used_date`);