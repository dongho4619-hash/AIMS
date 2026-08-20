CREATE TABLE `materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_key` text NOT NULL,
	`item_code` text,
	`item_name` text NOT NULL,
	`abbreviation` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`specification` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source_row` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_source_key_unique` ON `materials` (`source_key`);--> statement-breakpoint
CREATE INDEX `idx_materials_category_name` ON `materials` (`category`,`item_name`);--> statement-breakpoint
CREATE INDEX `idx_materials_item_code` ON `materials` (`item_code`);