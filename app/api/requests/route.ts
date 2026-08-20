import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase, getDb } from "../../../db";
import { materialRequests, materials, requestEdits } from "../../../db/schema";

const allowedStatuses = ["pending", "approved", "purchasing", "ready", "completed", "rejected"] as const;
const editableFields = ["quantity", "unit", "department", "requiredDate", "purpose", "urgency"] as const;
type EditableField = typeof editableFields[number];

function message(error: unknown) { return error instanceof Error ? error.message : "요청을 처리하지 못했습니다."; }
function parseCreatedAt(value: string) { return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`); }
function editDeadline(createdAt: string) {
  const created = parseCreatedAt(createdAt);
  const korea = new Date(created.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate(), 7, 0, 0));
}
function withEditAccess<T extends { requesterKey: string | null; createdAt: string }>(row: T, userId?: string) {
  const deadline = editDeadline(row.createdAt);
  return { ...row, canEdit: Boolean(userId && row.requesterKey === userId && Date.now() < deadline.getTime()), editableUntil: deadline.toISOString() };
}

export async function GET() {
  try {
    await ensureDatabase();
    const user = await getChatGPTUser();
    const rows = await getDb().select().from(materialRequests).orderBy(desc(materialRequests.createdAt), desc(materialRequests.id)).limit(100);
    return Response.json({ requests: rows.map(row => withEditAccess(row, user?.userId)) });
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
    if (!materialSourceKey || !requester || !department || !requiredDate || !Number.isInteger(quantity) || quantity < 1) return Response.json({ error: "품목, 수량, 신청자, 부서, 필요일을 확인해 주세요." }, { status: 400 });
    await ensureDatabase();
    const [material] = await getDb().select().from(materials).where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
    if (!material) return Response.json({ error: "자재 목록에서 유효한 품목을 선택해 주세요." }, { status: 400 });
    const now = new Date();
    const requestNumber = `MR-${now.getUTCFullYear().toString().slice(-2)}${(now.getUTCMonth() + 1).toString().padStart(2, "0")}${now.getUTCDate().toString().padStart(2, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const [created] = await getDb().insert(materialRequests).values({
      requestNumber, itemName: material.itemName, specification: material.specification || material.abbreviation || material.notes,
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

    if (payload.action === "edit") {
      const user = await getChatGPTUser();
      if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
      const [current] = await getDb().select().from(materialRequests).where(eq(materialRequests.id, id)).limit(1);
      if (!current) return Response.json({ error: "신청 건을 찾을 수 없습니다." }, { status: 404 });
      if (current.requesterKey !== user.userId) return Response.json({ error: "본인이 신청한 건만 수정할 수 있습니다." }, { status: 403 });
      if (Date.now() >= editDeadline(current.createdAt).getTime()) return Response.json({ error: "수정 가능 시간이 지났습니다. 신청 당일 오후 4시 이전에만 수정할 수 있습니다." }, { status: 403 });

      const next = {
        quantity: Number(payload.quantity), unit: String(payload.unit ?? "").trim(), department: String(payload.department ?? "").trim(),
        requiredDate: String(payload.requiredDate ?? "").trim(), purpose: String(payload.purpose ?? "").trim(), urgency: payload.urgency === "urgent" ? "urgent" : "normal",
      };
      if (!Number.isInteger(next.quantity) || next.quantity < 1 || !next.unit || !next.department || !next.requiredDate) return Response.json({ error: "수량, 단위, 부서, 필요일을 확인해 주세요." }, { status: 400 });
      const previous = Object.fromEntries(editableFields.map(field => [field, current[field]])) as Record<EditableField, unknown>;
      const changedFields = editableFields.filter(field => previous[field] !== next[field]);
      if (!changedFields.length) return Response.json({ error: "변경된 내용이 없습니다." }, { status: 400 });
      const db = getDb();
      const [updatedRows] = await db.batch([
        db.update(materialRequests).set({ ...next, updatedAt: new Date().toISOString() }).where(eq(materialRequests.id, id)).returning(),
        db.insert(requestEdits).values({ requestId: id, editorUserKey: user.userId, changedFields: JSON.stringify(changedFields), previousValues: JSON.stringify(previous), newValues: JSON.stringify(next) }),
      ]);
      const updated = updatedRows[0];
      return Response.json({ request: withEditAccess(updated, user.userId) });
    }

    const status = String(payload.status ?? "");
    if (!allowedStatuses.includes(status as typeof allowedStatuses[number])) return Response.json({ error: "변경할 상태를 확인해 주세요." }, { status: 400 });
    const [updated] = await getDb().update(materialRequests).set({ status, updatedAt: new Date().toISOString() }).where(eq(materialRequests.id, id)).returning();
    if (!updated) return Response.json({ error: "신청 건을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ request: updated });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}
