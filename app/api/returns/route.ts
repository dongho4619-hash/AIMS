import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateAccess } from "../../access";
import { ensureDatabase, getD1, getDb } from "../../../db";
import { materialReturns, materials, personalInventory, warehouseInventory } from "../../../db/schema";

function message(error: unknown) {
  return error instanceof Error ? error.message : "자재 반납을 처리하지 못했습니다.";
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const profile = await getOrCreateAccess(user);
    if (!profile.isAdmin) return Response.json({ error: "관리자만 입고 내역을 확인할 수 있습니다." }, { status: 403 });
    const db = getDb();
    const [returns, warehouse] = await Promise.all([
      db.select().from(materialReturns).orderBy(desc(materialReturns.returnedAt), desc(materialReturns.id)).limit(200),
      db.select({ materialSourceKey: warehouseInventory.materialSourceKey, quantity: warehouseInventory.quantity }).from(warehouseInventory),
    ]);
    return Response.json({ returns, warehouse });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const employeeId = String(payload.employeeId ?? "").trim();
    const materialSourceKey = String(payload.materialSourceKey ?? "").trim();
    const quantity = Number(payload.quantity);
    const reason = String(payload.reason ?? "").trim();
    if (!materialSourceKey || !Number.isInteger(quantity) || quantity < 1) {
      return Response.json({ error: "반납 자재와 수량을 확인해 주세요." }, { status: 400 });
    }
    await ensureDatabase();
    const db = getDb();
    const [material] = await db.select({ itemName: materials.itemName }).from(materials)
      .where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
    if (!material) return Response.json({ error: "반납할 자재를 찾을 수 없습니다." }, { status: 404 });
    const [stock] = await db.select({ quantity: personalInventory.quantity }).from(personalInventory)
      .where(and(eq(personalInventory.userKey, user.userId), eq(personalInventory.materialSourceKey, materialSourceKey))).limit(1);
    if (!stock || stock.quantity < quantity) return Response.json({ error: "개인 보유재고보다 많이 반납할 수 없습니다." }, { status: 400 });

    const now = new Date().toISOString();
    const d1 = getD1();
    const [, updateResult] = await d1.batch([
      d1.prepare(`INSERT INTO material_returns (user_key, employee_id, material_source_key, item_name, quantity, reason, returned_at)
        SELECT user_key, ?, material_source_key, ?, ?, ?, ? FROM personal_inventory
        WHERE user_key = ? AND material_source_key = ? AND quantity >= ?`)
        .bind(employeeId, material.itemName, quantity, reason, now, user.userId, materialSourceKey, quantity),
      d1.prepare(`UPDATE personal_inventory SET quantity = quantity - ?, updated_at = ?
        WHERE user_key = ? AND material_source_key = ? AND quantity >= ?`)
        .bind(quantity, now, user.userId, materialSourceKey, quantity),
    ]);
    if (!updateResult.meta.changes) return Response.json({ error: "재고가 변경되었습니다. 다시 확인해 주세요." }, { status: 409 });
    const [saved] = await db.select({ materialSourceKey: personalInventory.materialSourceKey, quantity: personalInventory.quantity })
      .from(personalInventory).where(and(eq(personalInventory.userKey, user.userId), eq(personalInventory.materialSourceKey, materialSourceKey))).limit(1);
    return Response.json({ inventory: saved, returned: { materialSourceKey, itemName: material.itemName, quantity, reason, returnedAt: now } });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const profile = await getOrCreateAccess(user);
    if (!profile.isAdmin) return Response.json({ error: "관리자만 반납 자재를 입고할 수 있습니다." }, { status: 403 });
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "반납 건을 확인해 주세요." }, { status: 400 });
    const now = new Date().toISOString();
    const d1 = getD1();
    const [, updateResult] = await d1.batch([
      d1.prepare(`INSERT INTO warehouse_inventory (material_source_key, quantity, updated_at)
        SELECT material_source_key, quantity, ? FROM material_returns WHERE id = ? AND status = 'pending'
        ON CONFLICT(material_source_key) DO UPDATE SET
          quantity = warehouse_inventory.quantity + excluded.quantity, updated_at = excluded.updated_at`).bind(now, id),
      d1.prepare(`UPDATE material_returns SET status = 'received', received_by = ?, received_at = ?
        WHERE id = ? AND status = 'pending'`).bind(user.userId, now, id),
    ]);
    if (!updateResult.meta.changes) return Response.json({ error: "이미 입고했거나 처리할 수 없는 반납 건입니다." }, { status: 409 });
    const db = getDb();
    const [received] = await db.select().from(materialReturns).where(eq(materialReturns.id, id)).limit(1);
    const [warehouse] = await db.select({ materialSourceKey: warehouseInventory.materialSourceKey, quantity: warehouseInventory.quantity })
      .from(warehouseInventory).where(eq(warehouseInventory.materialSourceKey, received.materialSourceKey)).limit(1);
    return Response.json({ returned: received, warehouse });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
