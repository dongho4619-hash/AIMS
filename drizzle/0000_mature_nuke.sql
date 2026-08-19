CREATE TABLE `material_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_number` text NOT NULL,
	`item_name` text NOT NULL,
	`specification` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text DEFAULT 'EA' NOT NULL,
	`requester` text NOT NULL,
	`department` text NOT NULL,
	`required_date` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`urgency` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `material_requests_request_number_unique` ON `material_requests` (`request_number`);