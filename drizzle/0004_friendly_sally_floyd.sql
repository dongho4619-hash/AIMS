CREATE TABLE `request_edits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`editor_user_key` text NOT NULL,
	`changed_fields` text NOT NULL,
	`previous_values` text NOT NULL,
	`new_values` text NOT NULL,
	`edited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_request_edits_request_time` ON `request_edits` (`request_id`,`edited_at`);--> statement-breakpoint
ALTER TABLE `material_requests` ADD `requester_key` text;