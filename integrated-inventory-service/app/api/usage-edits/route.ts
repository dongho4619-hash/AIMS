import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateAccess } from "../../access";
import { ensureDatabase, getDb } from "../../../db";
import { materialUsageEdits, materialUsages } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const url = new URL(request.url); const usageId = Number(url.searchParams.get("usageId"));
    if (!Number.isInteger(usageId)) return Response.json({ error: "사용 내역을 확인해 주세요." }, { status: 400 });
    await ensureDatabase(); const profile = await getOrCreateAccess(user);
    const [usage] = await getDb().select().from(materialUsages).where(eq(materialUsages.id, usageId)).limit(1);
    if (!usage) return Response.json({ error: "사용 내역을 찾을 수 없습니다." }, { status: 404 });
    if (usage.userKey !== user.userId && !profile.isAdmin) return Response.json({ error: "변경 내역을 볼 수 없습니다." }, { status: 403 });
    const rows = await getDb().select().from(materialUsageEdits).where(eq(materialUsageEdits.usageId, usageId)).orderBy(desc(materialUsageEdits.editedAt), desc(materialUsageEdits.id));
    return Response.json({ edits: rows.map(row => ({ ...row, changedFields: JSON.parse(row.changedFields), previousValues: JSON.parse(row.previousValues), newValues: JSON.parse(row.newValues) })) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "변경 내역을 불러오지 못했습니다." }, { status: 500 }); }
}
