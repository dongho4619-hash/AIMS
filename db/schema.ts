import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const materialRequests = sqliteTable("material_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestNumber: text("request_number").notNull().unique(),
  itemName: text("item_name").notNull(),
  specification: text("specification").notNull().default(""),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull().default("EA"),
  requester: text("requester").notNull(),
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
