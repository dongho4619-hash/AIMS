import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase, getD1, getDb } from "../../../db";
import { materials, personalInventory } from "../../../db/schema";

function message(error: unknown) {
  return error instanceof Error ? error.message : "자재 반납을 처리하지 못했습니다.";
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
