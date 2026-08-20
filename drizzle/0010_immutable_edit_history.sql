CREATE TRIGGER `prevent_request_edits_delete`
BEFORE DELETE ON `request_edits`
BEGIN
	SELECT RAISE(ABORT, 'request edit history is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `prevent_material_usage_edits_delete`
BEFORE DELETE ON `material_usage_edits`
BEGIN
	SELECT RAISE(ABORT, 'usage edit history is immutable');
END;
