import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import catalog from "../data/materials.json";
import * as schema from "./schema";

const CATALOG_VERSION = "anywater-2026-08-20-v1";

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
    d1.prepare(`CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      item_code TEXT,
      item_name TEXT NOT NULL,
      abbreviation TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      specification TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      source_row INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_materials_category_name ON materials (category, item_name)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_materials_item_code ON materials (item_code)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS catalog_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS material_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT NOT NULL UNIQUE,
      material_source_key TEXT,
      item_name TEXT NOT NULL,
      specification TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit TEXT NOT NULL DEFAULT 'EA',
      requester TEXT NOT NULL,
      requester_key TEXT,
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
    d1.prepare(`CREATE TABLE IF NOT EXISTS request_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      editor_user_key TEXT NOT NULL,
      changed_fields TEXT NOT NULL,
      previous_values TEXT NOT NULL,
      new_values TEXT NOT NULL,
      edited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_request_edits_request_time ON request_edits (request_id, edited_at DESC)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS personal_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL,
      material_source_key TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_inventory_user_material ON personal_inventory (user_key, material_source_key)"),
  ]);

  const current = await d1.prepare("SELECT version FROM catalog_meta WHERE id = 1").first<{ version: string }>();
  if (current?.version === CATALOG_VERSION) return;

  await d1.prepare("UPDATE materials SET active = 0").run();
  const upsertSql = `INSERT INTO materials (
    source_key, item_code, item_name, abbreviation, category, specification, notes, source_row, active, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  ON CONFLICT(source_key) DO UPDATE SET
    item_code = excluded.item_code,
    item_name = excluded.item_name,
    abbreviation = excluded.abbreviation,
    category = excluded.category,
    specification = excluded.specification,
    notes = excluded.notes,
    source_row = excluded.source_row,
    active = 1,
    updated_at = CURRENT_TIMESTAMP`;
  for (let index = 0; index < catalog.length; index += 75) {
    const chunk = catalog.slice(index, index + 75);
    await d1.batch(chunk.map((item) => d1.prepare(upsertSql).bind(
      item.sourceKey,
      item.itemCode,
      item.itemName,
      item.abbreviation,
      item.category,
      item.specification,
      item.notes,
      item.sourceRow,
    )));
  }
  await d1.prepare(`INSERT INTO catalog_meta (id, version, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET version = excluded.version, updated_at = CURRENT_TIMESTAMP`).bind(CATALOG_VERSION).run();
}
