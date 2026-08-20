import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureDatabase, getDb } from "../../../db";
import { materials, personalInventory } from "../../../db/schema";

function message(error: unknown) {
  return error instanceof Error ? error.message : "개인 보유재고를 처리하지 못했습니다.";
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    await ensureDatabase();
    const rows = await getDb().select({
      materialSourceKey: personalInventory.materialSourceKey,
      quantity: personalInventory.quantity,
    }).from(personalInventory).where(eq(personalInventory.userKey, user.userId));
    return Response.json({ inventory: rows });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const materialSourceKey = String(payload.materialSourceKey ?? "").trim();
    const quantity = Number(payload.quantity);
    if (!materialSourceKey || !Number.isInteger(quantity) || quantity < 0) {
      return Response.json({ error: "자재와 보유 수량을 확인해 주세요." }, { status: 400 });
    }
    await ensureDatabase();
    const [material] = await getDb().select({ sourceKey: materials.sourceKey }).from(materials)
      .where(and(eq(materials.sourceKey, materialSourceKey), eq(materials.active, true))).limit(1);
    if (!material) return Response.json({ error: "유효한 자재를 찾을 수 없습니다." }, { status: 404 });
    const [saved] = await getDb().insert(personalInventory).values({
      userKey: user.userId,
      materialSourceKey,
      quantity,
    }).onConflictDoUpdate({
      target: [personalInventory.userKey, personalInventory.materialSourceKey],
      set: { quantity, updatedAt: new Date().toISOString() },
    }).returning({ materialSourceKey: personalInventory.materialSourceKey, quantity: personalInventory.quantity });
    return Response.json({ inventory: saved });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
