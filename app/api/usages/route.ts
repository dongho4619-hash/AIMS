import { and, desc, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateAccess, hasAdminView } from "../../access";
import { ensureDatabase, getDb } from "../../../db";
import { materialUsageEdits, materialUsages, materials, personalInventory } from "../../../db/schema";

const editableFields = ["materialSourceKey", "itemName", "quantity", "storeName", "usedDate"] as const;
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function editDeadline(usedDate: string) { return new Date(`${usedDate}T16:00:00+09:00`); }
function withEditAccess<T extends { userKey: string; usedDate: string; status: string }>(row: T, userId: string) {
  const deadline = editDeadline(row.usedDate);
  return { ...row, canEdit: row.userKey === userId && row.status === "active" && Date.now() < deadline.getTime(), editableUntil: deadline.toISOString() };
}

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const employeeId = new URL(request.url).searchParams.get("employeeId")?.trim() ?? "";
    const profile = await getOrCreateAccess(user, employeeId);
    const rows = hasAdminView(profile)
      ? await getDb().select().from(materialUsages).orderBy(desc(materialUsages.usedDate), desc(materialUsages.id)).limit(300)
      : await getDb().select().from(materialUsages).where(eq(materialUsages.userKey, user.userId)).orderBy(desc(materialUsages.usedDate), desc(materialUsages.id)).limit(150);
    return Response.json({ usages: rows.map(row => withEditAccess(row, user.userId)) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "사용 내역을 불러오지 못했습니다." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const employeeId = String(payload.employeeId ?? "").trim();
    const storeName = String(payload.storeName ?? "").trim();
    const usedDate = String(payload.usedDate ?? "").trim();
    const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : [];
    if (!employeeId || !storeName || !validDate(usedDate) || !items.length) return Response.json({ error: "매장명, 사용일, 사용자재를 확인해 주세요." }, { status: 400 });
    await getOrCreateAccess(user, employeeId);
    const db = getDb();
    const prepared: Array<{ materialSourceKey: string; itemName: string; quantity: number; currentQuantity: number }> = [];
    for (const raw of items) {
      const materialSourceKey = String(raw.materialSourceKey ?? "").trim();
      const quantity = Number(raw.quantity);
      if (!materialSourceKey || !Number.isInteger(quantity) || quantity < 1) return Response.json({ error: "사용 수량을 확인해 주세요." }, { status: 400 });
      const [material] = await db.select({ itemName: materials.itemName }).from(materials).where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
      const [stock] = await db.select({ quantity: personalInventory.quantity }).from(personalInventory).where(and(eq(personalInventory.userKey, user.userId), eq(personalInventory.materialSourceKey, materialSourceKey))).limit(1);
      if (!material || !stock || stock.quantity < quantity) return Response.json({ error: `${material?.itemName ?? "선택 자재"}의 보유재고가 부족합니다.` }, { status: 400 });
      prepared.push({ materialSourceKey, itemName: material.itemName, quantity, currentQuantity: stock.quantity });
    }
    const now = new Date().toISOString();
    const results = await db.batch(prepared.flatMap(item => [
      db.update(personalInventory).set({ quantity: item.currentQuantity - item.quantity, updatedAt: now }).where(and(eq(personalInventory.userKey, user.userId), eq(personalInventory.materialSourceKey, item.materialSourceKey))),
      db.insert(materialUsages).values({ userKey: user.userId, employeeId, materialSourceKey: item.materialSourceKey, itemName: item.itemName, quantity: item.quantity, storeName, usedDate, updatedAt: now }).returning(),
    ]));
    const usages = results.filter((_, index) => index % 2 === 1).flat();
    return Response.json({ usages }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "사용자재를 등록하지 못했습니다." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "사용 내역을 확인해 주세요." }, { status: 400 });
    await ensureDatabase();
    const db = getDb();
    await getOrCreateAccess(user, String(payload.employeeId ?? ""));
    const [current] = await db.select().from(materialUsages).where(eq(materialUsages.id, id)).limit(1);
    if (!current) return Response.json({ error: "사용 내역을 찾을 수 없습니다." }, { status: 404 });
    if (current.userKey !== user.userId) return Response.json({ error: "본인의 사용 내역만 수정하거나 취소할 수 있습니다." }, { status: 403 });
    if (current.status === "cancelled") return Response.json({ error: "이미 취소된 사용 내역입니다." }, { status: 400 });
    if (Date.now() >= editDeadline(current.usedDate).getTime()) return Response.json({ error: "수정·취소 가능 시간이 지났습니다. 사용일 오후 4시 이전에만 가능합니다." }, { status: 403 });
    if (payload.action === "cancel") {
      const now = new Date().toISOString();
      const validCancel = and(eq(materialUsages.id, id), eq(materialUsages.status, "active"));
      const [, , updatedRows] = await db.batch([
        db.insert(personalInventory).select(db.select({
          userKey: materialUsages.userKey,
          materialSourceKey: materialUsages.materialSourceKey,
          quantity: materialUsages.quantity,
          updatedAt: sql<string>`${now}`,
        }).from(materialUsages).where(validCancel)).onConflictDoUpdate({
          target: [personalInventory.userKey, personalInventory.materialSourceKey],
          set: { quantity: sql`${personalInventory.quantity} + excluded.quantity`, updatedAt: now },
        }),
        db.insert(materialUsageEdits).select(db.select({
          usageId: materialUsages.id,
          editorUserKey: sql<string>`${user.userId}`,
          changedFields: sql<string>`${JSON.stringify(["status"])}`,
          previousValues: sql<string>`${JSON.stringify({ status: "active" })}`,
          newValues: sql<string>`${JSON.stringify({ status: "cancelled" })}`,
          editedAt: sql<string>`${now}`,
        }).from(materialUsages).where(validCancel)),
        db.update(materialUsages).set({ status: "cancelled", updatedAt: now }).where(validCancel).returning(),
      ]);
      if (!updatedRows[0]) return Response.json({ error: "이미 취소된 사용 내역입니다." }, { status: 409 });
      return Response.json({ usage: withEditAccess(updatedRows[0], user.userId) });
    }
    const quantity = Number(payload.quantity);
    const materialSourceKey = String(payload.materialSourceKey ?? "").trim();
    const storeName = String(payload.storeName ?? "").trim();
    const usedDate = String(payload.usedDate ?? "").trim();
    if (!Number.isInteger(quantity) || quantity < 1 || !materialSourceKey || !storeName || !validDate(usedDate)) return Response.json({ error: "수정 내용을 확인해 주세요." }, { status: 400 });
    const [material] = await db.select({ itemName: materials.itemName }).from(materials).where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
    if (!material) return Response.json({ error: "자재를 찾을 수 없습니다." }, { status: 404 });
    const ownerKey = current.userKey;
    const [oldStock] = await db.select().from(personalInventory).where(and(eq(personalInventory.userKey, ownerKey), eq(personalInventory.materialSourceKey, current.materialSourceKey))).limit(1);
    const [newStock] = materialSourceKey === current.materialSourceKey ? [oldStock] : await db.select().from(personalInventory).where(and(eq(personalInventory.userKey, ownerKey), eq(personalInventory.materialSourceKey, materialSourceKey))).limit(1);
    const available = (newStock?.quantity ?? 0) + (materialSourceKey === current.materialSourceKey ? current.quantity : 0);
    if (available < quantity) return Response.json({ error: "변경할 자재의 보유재고가 부족합니다." }, { status: 400 });
    const next = { materialSourceKey, itemName: material.itemName, quantity, storeName, usedDate };
    const previous = Object.fromEntries(editableFields.map(field => [field, current[field]]));
    const changedFields = editableFields.filter(field => previous[field] !== next[field]);
    if (!changedFields.length) return Response.json({ error: "변경된 내용이 없습니다." }, { status: 400 });
    const now = new Date().toISOString();
    const inventoryQueries = materialSourceKey === current.materialSourceKey
      ? [db.update(personalInventory).set({ quantity: available - quantity, updatedAt: now }).where(eq(personalInventory.id, oldStock!.id))]
      : [
          db.update(personalInventory).set({ quantity: (oldStock?.quantity ?? 0) + current.quantity, updatedAt: now }).where(eq(personalInventory.id, oldStock!.id)),
          db.insert(personalInventory).values({ userKey: ownerKey, materialSourceKey, quantity: (newStock?.quantity ?? 0) - quantity, updatedAt: now }).onConflictDoUpdate({ target: [personalInventory.userKey, personalInventory.materialSourceKey], set: { quantity: (newStock?.quantity ?? 0) - quantity, updatedAt: now } }),
        ];
    const results = await db.batch([
      ...inventoryQueries,
      db.update(materialUsages).set({ ...next, updatedAt: now }).where(eq(materialUsages.id, id)).returning(),
      db.insert(materialUsageEdits).values({ usageId: id, editorUserKey: user.userId, changedFields: JSON.stringify(changedFields), previousValues: JSON.stringify(previous), newValues: JSON.stringify(next), editedAt: now }),
    ]);
    const updatedRows = results[inventoryQueries.length] as typeof current[];
    return Response.json({ usage: withEditAccess(updatedRows[0], user.userId) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "사용 내역을 수정하지 못했습니다." }, { status: 500 }); }
}
