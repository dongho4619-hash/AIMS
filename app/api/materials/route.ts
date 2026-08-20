import { asc, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { materials } from "../../../db/schema";

export async function GET() {
  try {
    await ensureDatabase();
    const rows = await getDb().select({
      sourceKey: materials.sourceKey,
      itemCode: materials.itemCode,
      itemName: materials.itemName,
      abbreviation: materials.abbreviation,
      category: materials.category,
      specification: materials.specification,
      notes: materials.notes,
    }).from(materials).where(eq(materials.active, true)).orderBy(asc(materials.category), asc(materials.itemCode), asc(materials.itemName));
    return Response.json({ materials: rows, total: rows.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "자재 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
