import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const materials = sqliteTable("materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceKey: text("source_key").notNull().unique(),
  itemCode: text("item_code"),
  itemName: text("item_name").notNull(),
  abbreviation: text("abbreviation").notNull().default(""),
  category: text("category").notNull(),
  specification: text("specification").notNull().default(""),
  notes: text("notes").notNull().default(""),
  unit: text("unit").notNull().default("EA"),
  minimumStock: integer("minimum_stock").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  sortOrder: integer("sort_order").notNull().default(999999),
}, (table) => [
  index("idx_materials_category_name").on(table.category, table.itemName),
  index("idx_materials_item_code").on(table.itemCode),
  index("idx_materials_category_sort").on(table.category, table.sortOrder),
]);

export const materialRequests = sqliteTable("material_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestNumber: text("request_number").notNull().unique(),
  materialSourceKey: text("material_source_key"),
  itemName: text("item_name").notNull(),
  specification: text("specification").notNull().default(""),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull().default("EA"),
  requester: text("requester").notNull(),
  requesterKey: text("requester_key"),
  department: text("department").notNull(),
  requiredDate: text("required_date").notNull(),
  purpose: text("purpose").notNull().default(""),
  urgency: text("urgency").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_material_requests_status_created").on(table.status, table.createdAt),
  index("idx_material_requests_department").on(table.department),
]);

export const requestEdits = sqliteTable("request_edits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull(),
  editorUserKey: text("editor_user_key").notNull(),
  changedFields: text("changed_fields").notNull(),
  previousValues: text("previous_values").notNull(),
  newValues: text("new_values").notNull(),
  editedAt: text("edited_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_request_edits_request_time").on(table.requestId, table.editedAt),
]);

export const personalInventory = sqliteTable("personal_inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull(),
  materialSourceKey: text("material_source_key").notNull(),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_personal_inventory_user_material").on(table.userKey, table.materialSourceKey),
]);

export const materialReturns = sqliteTable("material_returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnNumber: text("return_number").notNull().unique(),
  requesterKey: text("requester_key").notNull(),
  requesterName: text("requester_name").notNull(),
  department: text("department").notNull(),
  materialSourceKey: text("material_source_key").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull().default("EA"),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  decidedAt: text("decided_at"),
  decidedBy: text("decided_by"),
}, (table) => [
  index("idx_returns_status_created").on(table.status, table.createdAt),
  index("idx_returns_requester_created").on(table.requesterKey, table.createdAt),
]);

export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  materialSourceKey: text("material_source_key").notNull().unique(),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appUsers = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  department: text("department").notNull().default("기술부"),
  role: text("role").notNull().default("user"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull().unique(),
  employeeId: text("employee_id").notNull().default(""),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  canViewAdmin: integer("can_view_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const materialUsages = sqliteTable("material_usages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull(),
  employeeId: text("employee_id").notNull(),
  materialSourceKey: text("material_source_key").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  storeName: text("store_name").notNull(),
  usedDate: text("used_date").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_material_usages_user_date").on(table.userKey, table.usedDate),
]);

export const materialUsageEdits = sqliteTable("material_usage_edits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usageId: integer("usage_id").notNull(),
  editorUserKey: text("editor_user_key").notNull(),
  changedFields: text("changed_fields").notNull(),
  previousValues: text("previous_values").notNull(),
  newValues: text("new_values").notNull(),
  editedAt: text("edited_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_material_usage_edits_usage_time").on(table.usageId, table.editedAt),
]);
