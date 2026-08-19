import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function getBinding() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

export function getDb() {
  return drizzle(getBinding(), { schema });
}

export async function ensureDatabase() {
  const d1 = getBinding();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS material_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      specification TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit TEXT NOT NULL DEFAULT 'EA',
      requester TEXT NOT NULL,
      department TEXT NOT NULL,
      required_date TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      urgency TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_material_requests_status_created ON material_requests (status, created_at DESC)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_material_requests_department ON material_requests (department)"),
  ]);
}
