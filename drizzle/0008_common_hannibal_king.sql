CREATE TABLE `material_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`employee_id` text NOT NULL,
	`material_source_key` text NOT NULL,
	`item_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`returned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_material_returns_user_time` ON `material_returns` (`user_key`,`returned_at`);