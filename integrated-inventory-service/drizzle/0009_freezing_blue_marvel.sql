CREATE TABLE `warehouse_inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`material_source_key` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouse_inventory_material_source_key_unique` ON `warehouse_inventory` (`material_source_key`);--> statement-breakpoint
ALTER TABLE `material_returns` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_returns` ADD `received_by` text;--> statement-breakpoint
ALTER TABLE `material_returns` ADD `received_at` text;--> statement-breakpoint
CREATE INDEX `idx_material_returns_status_time` ON `material_returns` (`status`,`returned_at`);