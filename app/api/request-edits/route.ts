import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase, getDb } from "../../../db";
import { materialRequests, requestEdits } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const requestId = Number(new URL(request.url).searchParams.get("requestId"));
    if (!Number.isInteger(requestId) || requestId < 1) return Response.json({ error: "신청 건을 확인해 주세요." }, { status: 400 });
    await ensureDatabase();
    const [item] = await getDb().select({ requesterKey: materialRequests.requesterKey }).from(materialRequests).where(eq(materialRequests.id, requestId)).limit(1);
    if (!item) return Response.json({ error: "신청 건을 찾을 수 없습니다." }, { status: 404 });
    if (item.requesterKey !== user.userId) return Response.json({ error: "본인의 수정 내역만 확인할 수 있습니다." }, { status: 403 });
    const rows = await getDb().select().from(requestEdits).where(eq(requestEdits.requestId, requestId)).orderBy(desc(requestEdits.editedAt), desc(requestEdits.id));
    return Response.json({ edits: rows.map(row => ({ ...row, changedFields: JSON.parse(row.changedFields), previousValues: JSON.parse(row.previousValues), newValues: JSON.parse(row.newValues) })) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "수정 내역을 불러오지 못했습니다." }, { status: 500 }); }
}
