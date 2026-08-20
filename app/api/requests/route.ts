import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase, getDb } from "../../../db";
import { materialRequests, materials, personalInventory, requestEdits } from "../../../db/schema";

const allowedStatuses = ["pending", "approved", "purchasing", "ready", "completed", "rejected"] as const;
const editableFields = ["quantity", "unit", "requiredDate", "purpose"] as const;
type EditableField = typeof editableFields[number];

function message(error: unknown) { return error instanceof Error ? error.message : "요청을 처리하지 못했습니다."; }
function editDeadline(requiredDate: string) {
  return new Date(`${requiredDate}T16:00:00+09:00`);
}
function ownsRequest(row: { requesterKey: string | null; requester: string }, userId?: string, employeeId?: string) {
  return Boolean(userId && (row.requesterKey === userId || (employeeId && row.requester === employeeId)));
}
function withEditAccess<T extends { requesterKey: string | null; requester: string; requiredDate: string; status: string }>(row: T, userId?: string, employeeId?: string) {
  const deadline = editDeadline(row.requiredDate);
  const editableStatus = !["cancelled", "completed", "rejected"].includes(row.status);
  const owned = ownsRequest(row, userId, employeeId);
  return { ...row, canEdit: owned && editableStatus && Date.now() < deadline.getTime(), canReceive: owned && editableStatus, editableUntil: deadline.toISOString() };
}
function validRequiredDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(editDeadline(value).getTime()); }

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const employeeId = new URL(request.url).searchParams.get("employeeId")?.trim();
    const rows = await getDb().select().from(materialRequests).orderBy(desc(materialRequests.createdAt), desc(materialRequests.id)).limit(100);
    const ownRows = rows.filter(row => ownsRequest(row, user.userId, employeeId));
    return Response.json({ requests: ownRows.map(row => withEditAccess(row, user.userId, employeeId)) });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const materialSourceKey = String(payload.materialSourceKey ?? "").trim();
    const requester = String(payload.requester ?? "").trim();
    const department = String(payload.department ?? "").trim();
    const requiredDate = String(payload.requiredDate ?? "").trim();
    const quantity = Number(payload.quantity);
    if (!materialSourceKey || !requester || !department || !validRequiredDate(requiredDate) || !Number.isInteger(quantity) || quantity < 1) return Response.json({ error: "품목, 수량, 신청자, 부서, 필요일을 확인해 주세요." }, { status: 400 });
    await ensureDatabase();
    const [material] = await getDb().select().from(materials).where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
    if (!material) return Response.json({ error: "자재 목록에서 유효한 품목을 선택해 주세요." }, { status: 400 });
    const now = new Date();
    const requestNumber = `MR-${now.getUTCFullYear().toString().slice(-2)}${(now.getUTCMonth() + 1).toString().padStart(2, "0")}${now.getUTCDate().toString().padStart(2, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const [created] = await getDb().insert(materialRequests).values({
      requestNumber, materialSourceKey: material.sourceKey, itemName: material.itemName, specification: material.specification || material.abbreviation || material.notes,
      quantity, unit: String(payload.unit ?? "EA").trim() || "EA", requester, requesterKey: user.userId, department, requiredDate,
      purpose: String(payload.purpose ?? "").trim(), urgency: payload.urgency === "urgent" ? "urgent" : "normal",
    }).returning();
    return Response.json({ request: withEditAccess(created, user.userId) }, { status: 201 });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "신청 건을 확인해 주세요." }, { status: 400 });
    await ensureDatabase();

    if (payload.action === "edit" || payload.action === "cancel" || payload.action === "receive") {
      const user = await getChatGPTUser();
      if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
      const [current] = await getDb().select().from(materialRequests).where(eq(materialRequests.id, id)).limit(1);
      if (!current) return Response.json({ error: "신청 건을 찾을 수 없습니다." }, { status: 404 });
      const employeeId = String(payload.employeeId ?? "").trim();
      if (!ownsRequest(current, user.userId, employeeId)) return Response.json({ error: "본인이 신청한 건만 수정하거나 취소할 수 있습니다." }, { status: 403 });
      if (["cancelled", "completed", "rejected"].includes(current.status)) return Response.json({ error: "이미 취소되었거나 처리가 끝난 신청입니다." }, { status: 400 });
      if (payload.action !== "receive" && Date.now() >= editDeadline(current.requiredDate).getTime()) return Response.json({ error: "수정·취소 가능 시간이 지났습니다. 필요일 오후 4시 이전에만 가능합니다." }, { status: 403 });

      const db = getDb();
      if (payload.action === "receive") {
        const [matchedMaterial] = current.materialSourceKey
          ? await db.select({ sourceKey: materials.sourceKey }).from(materials).where(and(eq(materials.sourceKey, current.materialSourceKey), eq(materials.active, true))).limit(1)
          : await db.select({ sourceKey: materials.sourceKey }).from(materials).where(and(eq(materials.itemName, current.itemName), eq(materials.active, true))).limit(1);
        if (!matchedMaterial) return Response.json({ error: "재고에 반영할 자재를 찾을 수 없습니다." }, { status: 404 });
        const now = new Date().toISOString();
        const validReceipt = and(eq(materialRequests.id, id), notInArray(materialRequests.status, ["cancelled", "completed", "rejected"]));
        const [, , updatedRows] = await db.batch([
          db.insert(personalInventory).select(db.select({
            userKey: sql<string>`${user.userId}`,
            materialSourceKey: sql<string>`${matchedMaterial.sourceKey}`,
            quantity: materialRequests.quantity,
            updatedAt: sql<string>`${now}`,
          }).from(materialRequests).where(validReceipt)).onConflictDoUpdate({
            target: [personalInventory.userKey, personalInventory.materialSourceKey],
            set: { quantity: sql`${personalInventory.quantity} + excluded.quantity`, updatedAt: now },
          }),
          db.insert(requestEdits).select(db.select({
            requestId: materialRequests.id,
            editorUserKey: sql<string>`${user.userId}`,
            changedFields: sql<string>`${JSON.stringify(["status"])}`,
            previousValues: sql<string>`${JSON.stringify({ status: current.status })}`,
            newValues: sql<string>`${JSON.stringify({ status: "completed" })}`,
            editedAt: sql<string>`${now}`,
          }).from(materialRequests).where(validReceipt)),
          db.update(materialRequests).set({ status: "completed", requesterKey: user.userId, materialSourceKey: matchedMaterial.sourceKey, updatedAt: now }).where(validReceipt).returning(),
        ]);
        if (!updatedRows[0]) return Response.json({ error: "이미 수령 확인했거나 처리할 수 없는 신청입니다." }, { status: 409 });
        const [inventoryRow] = await db.select({ materialSourceKey: personalInventory.materialSourceKey, quantity: personalInventory.quantity }).from(personalInventory)
          .where(and(eq(personalInventory.userKey, user.userId), eq(personalInventory.materialSourceKey, matchedMaterial.sourceKey))).limit(1);
        return Response.json({ request: withEditAccess(updatedRows[0], user.userId, employeeId), inventory: inventoryRow });
      }
      if (payload.action === "cancel") {
        const [updatedRows] = await db.batch([
          db.update(materialRequests).set({ status: "cancelled", requesterKey: user.userId, updatedAt: new Date().toISOString() }).where(eq(materialRequests.id, id)).returning(),
          db.insert(requestEdits).values({ requestId: id, editorUserKey: user.userId, changedFields: JSON.stringify(["status"]), previousValues: JSON.stringify({ status: current.status }), newValues: JSON.stringify({ status: "cancelled" }) }),
        ]);
        return Response.json({ request: withEditAccess(updatedRows[0], user.userId, employeeId) });
      }

      const next = {
        quantity: Number(payload.quantity), unit: String(payload.unit ?? "").trim(), department: current.department,
        requiredDate: String(payload.requiredDate ?? "").trim(), purpose: String(payload.purpose ?? "").trim(), urgency: current.urgency,
      };
      if (!Number.isInteger(next.quantity) || next.quantity < 1 || !next.unit || !next.department || !validRequiredDate(next.requiredDate)) return Response.json({ error: "수량, 단위, 부서, 필요일을 확인해 주세요." }, { status: 400 });
      const previous = Object.fromEntries(editableFields.map(field => [field, current[field]])) as Record<EditableField, unknown>;
      const changedFields = editableFields.filter(field => previous[field] !== next[field]);
      if (!changedFields.length) return Response.json({ error: "변경된 내용이 없습니다." }, { status: 400 });
      const [updatedRows] = await db.batch([
        db.update(materialRequests).set({ ...next, requesterKey: user.userId, updatedAt: new Date().toISOString() }).where(eq(materialRequests.id, id)).returning(),
        db.insert(requestEdits).values({ requestId: id, editorUserKey: user.userId, changedFields: JSON.stringify(changedFields), previousValues: JSON.stringify(previous), newValues: JSON.stringify(next) }),
      ]);
      const updated = updatedRows[0];
      return Response.json({ request: withEditAccess(updated, user.userId, employeeId) });
    }

    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const status = String(payload.status ?? "");
    if (!allowedStatuses.includes(status as typeof allowedStatuses[number])) return Response.json({ error: "변경할 상태를 확인해 주세요." }, { status: 400 });
    const [updated] = await getDb().update(materialRequests).set({ status, updatedAt: new Date().toISOString() }).where(eq(materialRequests.id, id)).returning();
    if (!updated) return Response.json({ error: "신청 건을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ request: updated });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}
