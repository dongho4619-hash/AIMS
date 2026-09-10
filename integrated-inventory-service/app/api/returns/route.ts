import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateAccess } from "../../access";
import { getD1, getDb } from "../../../db";
import { inventory, materialReturns, materials, personalInventory, userProfiles } from "../../../db/schema";

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
    const [returnRows, warehouse] = await Promise.all([
      db.select({ ret: materialReturns, employeeId: userProfiles.employeeId })
        .from(materialReturns)
        .leftJoin(userProfiles, eq(userProfiles.userKey, materialReturns.requesterKey))
        .orderBy(desc(materialReturns.createdAt), desc(materialReturns.id)).limit(200),
      db.select({ materialSourceKey: inventory.materialSourceKey, quantity: inventory.onHand }).from(inventory),
    ]);
    const returns = returnRows.map(({ ret, employeeId }) => ({
      id: ret.id,
      userKey: ret.requesterKey,
      employeeId: employeeId ?? "",
      materialSourceKey: ret.materialSourceKey,
      itemName: ret.itemName,
      quantity: ret.quantity,
      reason: ret.reason,
      status: ret.status,
      returnedAt: ret.createdAt,
      receivedAt: ret.decidedAt,
    }));
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
    const profile = await getOrCreateAccess(user, employeeId);
    const db = getDb();
    const [material] = await db.select({ itemName: materials.itemName, unit: materials.unit }).from(materials)
      .where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
    if (!material) return Response.json({ error: "반납할 자재를 찾을 수 없습니다." }, { status: 404 });
    const [stock] = await db.select({ quantity: personalInventory.quantity }).from(personalInventory)
      .where(and(eq(personalInventory.userKey, user.userId), eq(personalInventory.materialSourceKey, materialSourceKey))).limit(1);
    if (!stock || stock.quantity < quantity) return Response.json({ error: "개인 보유재고보다 많이 반납할 수 없습니다." }, { status: 400 });

    const now = new Date().toISOString();
    const returnNumber = `RT-${now.slice(2, 4)}${now.slice(5, 7)}${now.slice(8, 10)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const d1 = getD1();
    const [, updateResult] = await d1.batch([
      d1.prepare(`INSERT INTO material_returns (
        return_number, requester_key, requester_name, department, material_source_key, item_name, quantity, unit, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
        .bind(returnNumber, user.userId, user.displayName, profile.department, materialSourceKey, material.itemName, quantity, material.unit, reason, now),
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
      d1.prepare(`INSERT INTO inventory (material_source_key, on_hand, updated_at)
        SELECT material_source_key, quantity, ? FROM material_returns WHERE id = ? AND status = 'pending'
        ON CONFLICT(material_source_key) DO UPDATE SET
          on_hand = inventory.on_hand + excluded.on_hand, updated_at = excluded.updated_at`).bind(now, id),
      d1.prepare(`UPDATE material_returns SET status = 'received', decided_by = ?, decided_at = ?
        WHERE id = ? AND status = 'pending'`).bind(user.userId, now, id),
    ]);
    if (!updateResult.meta.changes) return Response.json({ error: "이미 입고했거나 처리할 수 없는 반납 건입니다." }, { status: 409 });
    const db = getDb();
    const [received] = await db.select().from(materialReturns).where(eq(materialReturns.id, id)).limit(1);
    const [warehouse] = await db.select({ materialSourceKey: inventory.materialSourceKey, quantity: inventory.onHand })
      .from(inventory).where(eq(inventory.materialSourceKey, received.materialSourceKey)).limit(1);
    return Response.json({
      returned: {
        id: received.id,
        userKey: received.requesterKey,
        materialSourceKey: received.materialSourceKey,
        itemName: received.itemName,
        quantity: received.quantity,
        reason: received.reason,
        status: received.status,
        returnedAt: received.createdAt,
        receivedAt: received.decidedAt,
      },
      warehouse,
    });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
