import { desc, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { materialRequests } from "../../../db/schema";

const allowedStatuses = ["pending", "approved", "purchasing", "ready", "completed", "rejected"] as const;

function message(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

export async function GET() {
  try {
    await ensureDatabase();
    const rows = await getDb().select().from(materialRequests).orderBy(desc(materialRequests.createdAt), desc(materialRequests.id)).limit(100);
    return Response.json({ requests: rows });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const itemName = String(payload.itemName ?? "").trim();
    const requester = String(payload.requester ?? "").trim();
    const department = String(payload.department ?? "").trim();
    const requiredDate = String(payload.requiredDate ?? "").trim();
    const quantity = Number(payload.quantity);
    if (!itemName || !requester || !department || !requiredDate || !Number.isInteger(quantity) || quantity < 1) {
      return Response.json({ error: "품목, 수량, 신청자, 부서, 필요일을 확인해 주세요." }, { status: 400 });
    }
    await ensureDatabase();
    const now = new Date();
    const requestNumber = `MR-${now.getUTCFullYear().toString().slice(-2)}${(now.getUTCMonth() + 1).toString().padStart(2, "0")}${now.getUTCDate().toString().padStart(2, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const [created] = await getDb().insert(materialRequests).values({
      requestNumber,
      itemName,
      specification: String(payload.specification ?? "").trim(),
      quantity,
      unit: String(payload.unit ?? "EA").trim() || "EA",
      requester,
      department,
      requiredDate,
      purpose: String(payload.purpose ?? "").trim(),
      urgency: payload.urgency === "urgent" ? "urgent" : "normal",
    }).returning();
    return Response.json({ request: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { id?: number; status?: string };
    if (!payload.id || !allowedStatuses.includes(payload.status as typeof allowedStatuses[number])) {
      return Response.json({ error: "변경할 상태를 확인해 주세요." }, { status: 400 });
    }
    await ensureDatabase();
    const [updated] = await getDb().update(materialRequests).set({ status: payload.status, updatedAt: new Date().toISOString() }).where(eq(materialRequests.id, payload.id)).returning();
    if (!updated) return Response.json({ error: "신청 건을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ request: updated });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
